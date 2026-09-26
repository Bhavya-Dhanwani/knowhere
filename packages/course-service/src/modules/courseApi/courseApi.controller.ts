import { Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import {
  UploadResourceRequest,
  CreateMcqRequest,
  CreateCodeQuestionRequest,
  CreateSubmoduleRequest,
  CreateModuleRequest,
  CreateCourseRequest,
  AddModuleRequest,
  CheckMcqRequest
} from './courseApi.types.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import ResourceDao from '../../shared/dao/resource.dao.js';
import McqDao from '../../shared/dao/mcq.dao.js';
import McqAttemptDao from '../../shared/dao/mcqAttempt.dao.js';
import CodeQuestionDao from '../../shared/dao/codeQuestion.dao.js';
import CourseDao from '../../shared/dao/course.dao.js';
import ModuleDao from '../../shared/dao/module.dao.js';
import SubmoduleDao from '../../shared/dao/submodule.dao.js';
import s3Service from '../../services/s3.service.js';
import drmWorkerService from '../../services/drmWorker.service.js';
import videoStreamService from '../../services/videoStream.service.js';
import {
  hlsPrefix,
  SEGMENT_FILE,
  verifySegmentToken,
  viewerPlaylist
} from '../../services/hls.service.js';
import { judgeCode } from '@lms/shared';
import mistralGeneratorService from '../../services/mistralGenerator.service.js';
import activityAnalysisService from '../../services/activityAnalysis.service.js';
import Ok from '../../shared/responses/Ok.response.js';
import Created from '../../shared/responses/Created.response.js';
import NotFound from '../../shared/errors/NotFound.error.js';
import BadRequest from '../../shared/errors/BadRequest.error.js';
import Forbidden from '../../shared/errors/Forbidden.error.js';
import Unauthorized from '../../shared/errors/Unauthorized.error.js';
import logger from '../../shared/config/logger.config.js';
import env from '../../shared/config/env.config.js';
import {
  assertCanManageCourse,
  assertContentAccess,
  memberships
} from '../../services/access.service.js';

const UPLOAD_URL_TTL_SEC = 900;
const MAX_TEST_CASES = 100;

const param = (req: AuthenticatedRequest) =>
  Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

// throws unless every id exists — used before anything is linked to it
function assertAllFound(kind: string, wanted: string[], found: { _id: unknown }[]) {
  const have = new Set(found.map((f) => String(f._id)));
  const missing = [...new Set(wanted)].filter((id) => !have.has(id));
  if (missing.length) throw new BadRequest(`Unknown ${kind} id(s): ${missing.join(', ')}`);
}

class CourseApiController {
  private resourceDao = new ResourceDao();
  private mcqDao = new McqDao();
  private mcqAttemptDao = new McqAttemptDao();
  private codeQuestionDao = new CodeQuestionDao();
  private courseDao = new CourseDao();
  private moduleDao = new ModuleDao();
  private submoduleDao = new SubmoduleDao();

  // 1. POST /api/course/upload-resource
  uploadResource = async (req: UploadResourceRequest, res: Response, next: NextFunction) => {
    try {
      const { fileName, mimeType, fileSize, resourceType, courseId } = req.body;
      const ownerId = req.user!.userId;

      // resources are usually uploaded before a course exists; if one is given, check ownership
      if (courseId) {
        const course = await this.courseDao.findCourseById(courseId);
        if (!course) throw new NotFound(`Course with ID '${courseId}' not found.`);
        if (req.user!.role !== 'admin' && course.instructorId !== ownerId) {
          throw new Forbidden('You do not have permission to upload resources to this course.');
        }
      }

      const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const s3Key = `resources/${ownerId}/${randomUUID()}-${cleanFileName}`;
      const isVideo = resourceType === 'video';

      const resource = await this.resourceDao.createResource({
        fileName,
        mimeType,
        fileSizeBytes: Number(fileSize),
        resourceType,
        courseId: courseId ? new Types.ObjectId(courseId) : null,
        ownerId,
        s3Key,
        status: 'PENDING_UPLOAD',
        drmStatus: isVideo ? 'DRM_PENDING' : undefined
      });

      const uploadUrl = await s3Service.generateUploadUrl(s3Key, mimeType, UPLOAD_URL_TTL_SEC);

      // worker waits for the object to land in S3, then marks it ready (videos get DRM first)
      drmWorkerService.enqueueUploadWatch(
        resource._id.toString(),
        s3Key,
        isVideo,
        UPLOAD_URL_TTL_SEC
      );

      return Ok(res, 'Upload URL generated', {
        resourceId: resource._id.toString(),
        uploadUrl,
        s3Key,
        expiresIn: UPLOAD_URL_TTL_SEC,
        status: 'PENDING_UPLOAD'
      });
    } catch (error) {
      next(error);
    }
  };

  // 2. POST /api/course/mcq
  createMcq = async (req: CreateMcqRequest, res: Response, next: NextFunction) => {
    try {
      const {
        question,
        options,
        correctOptionIndex,
        explanation,
        questionResourceIds = [],
        explanationResourceIds = [],
        tags,
        difficulty,
        courseId
      } = req.body;

      if (!options || options.length !== 4) {
        throw new BadRequest('An MCQ must contain exactly 4 options.');
      }
      if (correctOptionIndex < 0 || correctOptionIndex > 3) {
        throw new BadRequest('correctOptionIndex must be an integer between 0 and 3.');
      }

      // attachments (images, PDFs...) on the question, options or explanation must be real resources
      const attached = [
        ...questionResourceIds,
        ...explanationResourceIds,
        ...options.flatMap((o) => o.resourceIds || [])
      ];
      if (attached.length) {
        assertAllFound('resource', attached, await this.resourceDao.findResourcesByIds(attached));
      }

      const toIds = (ids: string[]) => ids.map((id) => new Types.ObjectId(id));
      const mcq = await this.mcqDao.createMcq({
        question,
        options: options.map((opt, idx) => ({
          id: `option_${idx}`,
          text: opt.text,
          resourceIds: toIds(opt.resourceIds || [])
        })),
        correctOptionIndex,
        explanation,
        questionResourceIds: toIds(questionResourceIds),
        explanationResourceIds: toIds(explanationResourceIds),
        tags: tags || [],
        difficulty: difficulty || 'easy',
        ...(req.body.points !== undefined && { points: Number(req.body.points) }),
        creatorId: req.user!.userId,
        courseId: courseId ? new Types.ObjectId(courseId) : null
      });

      return Created(res, 'MCQ created successfully', { mcqId: mcq._id.toString() });
    } catch (error) {
      next(error);
    }
  };

  // 3. POST /api/course/code-question
  createCodeQuestion = async (
    req: CreateCodeQuestionRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const {
        title,
        description,
        constraints,
        inputFormat,
        outputFormat,
        examples = [],
        testCases = [],
        difficulty,
        supportedLanguages,
        courseId,
        testCaseGeneration,
        referenceSolution,
        points
      } = req.body;
      if (testCaseGeneration?.enabled && !referenceSolution?.code) {
        throw new BadRequest(
          'Add a reference solution to generate test cases: expected outputs are computed from it.'
        );
      }

      const publicExamples = examples.slice(0, 5);
      const manual = testCases.slice(0, MAX_TEST_CASES).map((t) => ({
        input: t.input,
        expectedOutput: t.expectedOutput,
        isHidden: true
      }));

      // AI fills the remaining slots up to 100 hidden test cases
      let generationStatus: 'NOT_REQUESTED' | 'COMPLETED' | 'FAILED' = 'NOT_REQUESTED';
      let generationError: string | undefined;
      let generated: typeof manual = [];
      if (testCaseGeneration?.enabled) {
        const wanted = Math.min(
          testCaseGeneration.requestedCount ?? MAX_TEST_CASES - manual.length,
          MAX_TEST_CASES - manual.length
        );
        const ai = await mistralGeneratorService.generateTestCases({
          title,
          description,
          constraints,
          inputFormat,
          outputFormat,
          examples: publicExamples,
          requestedCount: wanted,
          referenceSolution: referenceSolution!
        });
        generated = ai.testCases;
        generationStatus = ai.success ? 'COMPLETED' : 'FAILED';
        generationError = ai.errorMessage;
      }

      const allTests = [...manual, ...generated].slice(0, MAX_TEST_CASES);
      const question = await this.codeQuestionDao.createQuestion({
        title,
        description,
        constraints,
        inputFormat,
        outputFormat,
        examples: publicExamples,
        difficulty: difficulty || 'easy',
        supportedLanguages: supportedLanguages || ['javascript', 'python', 'cpp', 'java'],
        ...(points !== undefined && { points: Number(points) }),
        referenceSolution: referenceSolution || null,
        testCases: allTests,
        testCaseGenerationStatus: generationStatus,
        creatorId: req.user!.userId,
        courseId: courseId ? new Types.ObjectId(courseId) : null
      });

      return Created(res, 'Coding question created', {
        questionId: question._id.toString(),
        testCaseGenerationStatus: generationStatus,
        generationError,
        publicExampleCount: publicExamples.length,
        hiddenTestCaseCount: allTests.length
      });
    } catch (error) {
      next(error);
    }
  };

  // 4. POST /api/course/submodule — built from already-created resources, MCQs and coding questions
  createSubmodule = async (req: CreateSubmoduleRequest, res: Response, next: NextFunction) => {
    try {
      const { title, description, courseId, content = [] } = req.body;

      const isFile = (type: string) => type === 'video' || type === 'resource';
      const refOf = (c: (typeof content)[number]) => (isFile(c.type) ? c.resourceId : c.contentId);
      const missingRef = content.find((c) => !refOf(c));
      if (missingRef) {
        throw new BadRequest(
          `Content of type '${missingRef.type}' needs ${isFile(missingRef.type) ? 'resourceId' : 'contentId'}.`
        );
      }

      const ids = (types: string[]) =>
        content.filter((c) => types.includes(c.type)).map((c) => String(refOf(c)));
      const resIds = ids(['video', 'resource']);
      const mcqIds = ids(['mcq']);
      const codeIds = ids(['code-question']);
      if (resIds.length) {
        const found = await this.resourceDao.findResourcesByIds(resIds);
        assertAllFound('resource', resIds, found);
        const videoIds = new Set(ids(['video']));
        const wrong = found.find((r) => videoIds.has(String(r._id)) && r.resourceType !== 'video');
        if (wrong) throw new BadRequest(`Resource '${wrong._id}' is not a video.`);
      }
      if (mcqIds.length) assertAllFound('mcq', mcqIds, await this.mcqDao.findMcqsByIds(mcqIds));
      if (codeIds.length) {
        assertAllFound(
          'code-question',
          codeIds,
          await this.codeQuestionDao.findQuestionsByIds(codeIds)
        );
      }

      const submodule = await this.submoduleDao.createSubmodule({
        title,
        description: description || '',
        creatorId: req.user!.userId,
        ...(courseId ? { courseId } : {}),
        order: 1,
        content: content.map((c, idx) => ({
          type: c.type,
          resourceId: c.resourceId ? new Types.ObjectId(c.resourceId) : null,
          contentId: c.contentId ? new Types.ObjectId(c.contentId) : null,
          order: c.order || idx + 1
        }))
      });

      return Created(res, 'Submodule created successfully', {
        submoduleId: submodule._id.toString()
      });
    } catch (error) {
      next(error);
    }
  };

  // 5. POST /api/course/module — groups submodules under a relative deadline (durationDays)
  createModule = async (req: CreateModuleRequest, res: Response, next: NextFunction) => {
    try {
      const { title, description, submoduleIds = [], durationDays, progressRequirement } = req.body;

      if (submoduleIds.length) {
        assertAllFound(
          'submodule',
          submoduleIds,
          await this.submoduleDao.findSubmodulesByIds(submoduleIds)
        );
      }

      const createdModule = await this.moduleDao.createModule({
        title,
        description: description || '',
        creatorId: req.user!.userId,
        submoduleIds,
        durationDays: Number(durationDays),
        progressRequirement: progressRequirement !== undefined ? Number(progressRequirement) : 70
      });

      return Created(res, 'Module created successfully', {
        moduleId: createdModule._id.toString()
      });
    } catch (error) {
      next(error);
    }
  };

  // 6. POST /api/course — modules optional; each starts released now (schedule later via add-module)
  createCourse = async (req: CreateCourseRequest, res: Response, next: NextFunction) => {
    try {
      const { title, description, modules = [], status, settings } = req.body;

      if (modules.length) {
        assertAllFound('module', modules, await this.moduleDao.findModulesByIds(modules));
      }

      const now = new Date();
      const course = await this.courseDao.createCourse({
        title,
        description: description || '',
        instructorId: req.user!.userId,
        status: status || 'draft',
        modules: modules.map((modId, idx) => ({
          moduleId: new Types.ObjectId(modId),
          order: idx + 1,
          releasePolicy: { type: 'immediate', releaseAt: now, allowLateJoinerCatchUp: true }
        })),
        settings: {
          allowLateEnrollment: settings?.allowLateEnrollment ?? true,
          defaultModuleDurationDays: settings?.defaultModuleDurationDays ?? 7,
          progressionThreshold: settings?.progressionThreshold ?? 70
        }
      });

      // the creator becomes the course's admin so they can enrol people and moderate its community
      try {
        await memberships.assign(course._id.toString(), req.user!.userId, 'admin');
      } catch (err) {
        logger.warn(
          { err, courseId: course._id },
          'Could not enrol course creator as course admin'
        );
      }

      return Created(res, 'Course created successfully', {
        courseId: course._id.toString(),
        status: course.status
      });
    } catch (error) {
      next(error);
    }
  };

  // 7. POST /api/course/add-module — optional releaseAt schedules when the module unlocks
  addModule = async (req: AddModuleRequest, res: Response, next: NextFunction) => {
    try {
      const { courseId, moduleId, order, releasePolicy } = req.body;

      const course = await this.courseDao.findCourseById(courseId);
      if (!course) throw new NotFound(`Course with ID '${courseId}' not found.`);
      await assertCanManageCourse(req.user!, course);
      if (!(await this.moduleDao.findModuleById(moduleId))) {
        throw new NotFound(`Module with ID '${moduleId}' not found.`);
      }

      const releaseAt = releasePolicy?.releaseAt ? new Date(releasePolicy.releaseAt) : new Date();
      if (Number.isNaN(releaseAt.getTime())) throw new BadRequest('releaseAt is not a valid date.');
      const finalOrder = order ? Number(order) : (course.modules?.length || 0) + 1;

      await this.courseDao.addModuleToCourse(courseId, {
        moduleId: new Types.ObjectId(moduleId),
        order: finalOrder,
        releasePolicy: {
          type: releasePolicy?.releaseAt ? 'scheduled' : 'immediate',
          releaseAt,
          allowLateJoinerCatchUp: releasePolicy?.allowLateJoinerCatchUp ?? true
        }
      });

      return Created(res, 'Module added to course successfully', {
        courseId,
        moduleId,
        order: finalOrder,
        releaseAt
      });
    } catch (error) {
      next(error);
    }
  };

  // 8. GET /api/course/mcq/:id — question and options only (attachments included, answer never)
  getMcq = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await assertContentAccess(
        req.user!,
        param(req),
        req.query.courseId ? String(req.query.courseId) : undefined
      );
      const mcq = await this.mcqDao.findMcqById(param(req));
      if (!mcq) throw new NotFound(`MCQ with ID '${param(req)}' not found.`);

      return res.status(200).json({
        question: mcq.question,
        questionResourceIds: mcq.questionResourceIds || [],
        options: mcq.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          resourceIds: opt.resourceIds || []
        }))
      });
    } catch (error) {
      next(error);
    }
  };

  // 9. GET /api/course/video/:id — byte-range streaming, every chunk tied to the viewer's email
  streamVideo = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userEmail = req.user?.email;
      if (!userEmail) {
        throw new Unauthorized('Video playback requires an email in the access token.');
      }

      const { manager } = await assertContentAccess(
        req.user!,
        param(req),
        req.query.courseId ? String(req.query.courseId) : undefined
      );
      const resource = await this.resourceDao.findResourceById(param(req));
      if (!resource || resource.status === 'DELETED') {
        throw new NotFound(`Video resource with ID '${param(req)}' not found.`);
      }
      if (resource.resourceType !== 'video') {
        throw new BadRequest('Requested resource is not a video.');
      }
      // once the encrypted rendition exists, learners only get HLS (the plain file stays staff-only)
      if (resource.drmStatus === 'DRM_READY' && !manager) {
        throw new Forbidden('This video streams encrypted. Open it from the lesson player.');
      }

      logger.info(
        { resourceId: resource._id.toString(), userEmail, range: req.headers.range },
        'Video chunk requested'
      );
      res.setHeader('X-Viewer-Email', userEmail);
      res.setHeader('Cache-Control', 'private, no-store');

      await videoStreamService.streamVideoChunk(res, {
        rangeHeader: req.headers.range,
        s3Key: resource.s3Key,
        fileSizeBytes: resource.fileSizeBytes,
        mimeType: resource.mimeType
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/course/video/:id/hls.m3u8 — encrypted HLS playlist for this viewer
  hlsPlaylist = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const courseId = req.query.courseId ? String(req.query.courseId) : undefined;
      await assertContentAccess(req.user!, param(req), courseId);
      const resource = await this.resourceDao.findResourceById(param(req));
      if (!resource || resource.status === 'DELETED' || resource.drmStatus !== 'DRM_READY') {
        throw new NotFound('No encrypted stream for this video yet.');
      }
      const keyUrl = `key${courseId ? `?courseId=${encodeURIComponent(courseId)}` : ''}`;
      const playlist = await viewerPlaylist(param(req), keyUrl);
      if (!playlist) throw new NotFound('The encrypted stream is missing from storage.');
      res.setHeader('Cache-Control', 'private, no-store');
      res.type('application/vnd.apple.mpegurl').send(playlist);
    } catch (error) {
      next(error);
    }
  };

  // GET /api/course/video/:id/seg/:file?t= — token-checked redirect to a fresh signed segment URL
  hlsSegment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const file = String(req.params.file);
      if (
        !SEGMENT_FILE.test(file) ||
        !verifySegmentToken(param(req), file, String(req.query.t || ''))
      ) {
        throw new Forbidden('This video link has expired. Reload the lesson.');
      }
      const url = await s3Service.generateDownloadUrl(hlsPrefix(param(req)) + file, undefined, 60);
      res.setHeader('Cache-Control', 'private, max-age=30');
      res.redirect(302, url);
    } catch (error) {
      next(error);
    }
  };

  // GET /api/course/video/:id/source — short-lived signed URL to the original upload, so the
  // browser streams it with native range requests (used until the encrypted rendition exists)
  videoSource = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { manager } = await assertContentAccess(
        req.user!,
        param(req),
        req.query.courseId ? String(req.query.courseId) : undefined
      );
      const resource = await this.resourceDao.findResourceById(param(req));
      if (!resource || resource.status === 'DELETED' || resource.resourceType !== 'video') {
        throw new NotFound('Video not found.');
      }
      if (resource.drmStatus === 'DRM_READY' && !manager) {
        throw new Forbidden('This video streams encrypted. Open it from the lesson player.');
      }
      logger.info({ resourceId: param(req), userEmail: req.user?.email }, 'Video source issued');
      return Ok(res, 'Video source', {
        url: await s3Service.generateDownloadUrl(resource.s3Key, undefined, 600),
        mimeType: resource.mimeType
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/course/video/:id/key — the AES-128 key, only after the same access check
  hlsKey = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await assertContentAccess(
        req.user!,
        param(req),
        req.query.courseId ? String(req.query.courseId) : undefined
      );
      const resource = await this.resourceDao.findResourceWithKey(param(req));
      if (!resource?.hlsKey) throw new NotFound('No encryption key for this video.');
      logger.info({ resourceId: param(req), userEmail: req.user?.email }, 'HLS key issued');
      res.setHeader('Cache-Control', 'private, no-store');
      if (req.user?.email) res.setHeader('X-Viewer-Email', req.user.email);
      res.type('application/octet-stream').send(Buffer.from(resource.hlsKey, 'hex'));
    } catch (error) {
      next(error);
    }
  };

  // 10. GET /api/course/resource/:id — non-video files via a short-lived presigned download URL
  getResource = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await assertContentAccess(
        req.user!,
        param(req),
        req.query.courseId ? String(req.query.courseId) : undefined
      );
      const resource = await this.resourceDao.findResourceById(param(req));
      if (!resource || resource.status === 'DELETED') {
        throw new NotFound(`Resource with ID '${param(req)}' not found.`);
      }
      if (resource.resourceType === 'video') {
        throw new BadRequest('Videos are streamed from /api/course/video/:id.');
      }

      const downloadUrl = await s3Service.generateDownloadUrl(resource.s3Key, undefined, 300);
      return Ok(res, 'Resource fetched successfully', {
        resourceId: resource._id.toString(),
        fileName: resource.fileName,
        mimeType: resource.mimeType,
        resourceType: resource.resourceType,
        downloadUrl,
        expiresIn: 300
      });
    } catch (error) {
      next(error);
    }
  };

  // 11. POST /api/course/chk-mcq — records the attempt; the explanation is only shown when correct
  checkMcq = async (req: CheckMcqRequest, res: Response, next: NextFunction) => {
    try {
      const { mcqId, selectedOptionId, courseId } = req.body;
      const userId = req.user!.userId;
      await assertContentAccess(req.user!, mcqId, courseId);

      const mcq = await this.mcqDao.findMcqById(mcqId);
      if (!mcq) throw new NotFound(`MCQ with ID '${mcqId}' not found.`);

      const correctOption = mcq.options[mcq.correctOptionIndex];
      const isCorrect =
        Boolean(correctOption) &&
        (selectedOptionId === correctOption.id ||
          selectedOptionId === `option_${mcq.correctOptionIndex}`);

      const attemptNumber = (await this.mcqAttemptDao.getAttemptCount(mcqId, userId)) + 1;
      await this.mcqAttemptDao.recordAttempt({
        mcqId: mcq._id,
        userId,
        courseId: mcq.courseId || null,
        selectedOptionId,
        selectedOptionIndex: mcq.options.findIndex((o) => o.id === selectedOptionId),
        isCorrect,
        scoreAwarded: isCorrect ? 10 : 0,
        attemptNumber
      });

      if (mcq.courseId) {
        await activityAnalysisService.logEvent(
          userId,
          mcq.courseId.toString(),
          isCorrect ? 'MCQ_ANSWERED_CORRECT' : 'MCQ_ANSWERED_INCORRECT',
          { mcqId, isCorrect, attemptNumber }
        );
      }

      return Ok(res, 'MCQ evaluation completed', {
        isCorrect,
        attemptNumber,
        ...(isCorrect ? { explanation: mcq.explanation || '' } : {})
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/course/code-question/:id — learner view: hidden test cases never leave the server
  getCodeQuestion = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await assertContentAccess(
        req.user!,
        param(req),
        req.query.courseId ? String(req.query.courseId) : undefined
      );
      const q = await this.codeQuestionDao.findQuestionById(param(req));
      if (!q) throw new NotFound(`Coding question '${param(req)}' not found.`);

      return Ok(res, 'Coding question fetched successfully', {
        questionId: q._id.toString(),
        title: q.title,
        description: q.description,
        constraints: q.constraints,
        inputFormat: q.inputFormat,
        outputFormat: q.outputFormat,
        examples: q.examples,
        difficulty: q.difficulty,
        supportedLanguages: q.supportedLanguages,
        hiddenTestCaseCount: q.testCases.filter((t) => t.isHidden).length
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/course/code-question/:id/run — runs a solution against the public examples only,
  // so learners see their real output per example (hidden tests stay on the submit path)
  runCodeQuestion = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await assertContentAccess(req.user!, param(req), req.body.courseId);
      const q = await this.codeQuestionDao.findQuestionById(param(req));
      if (!q) throw new NotFound(`Coding question '${param(req)}' not found.`);
      if (!q.supportedLanguages.includes(req.body.language)) {
        throw new BadRequest(`This question accepts ${q.supportedLanguages.join(', ')}.`);
      }
      const cases = q.examples.map((e) => ({ input: e.input, expectedOutput: e.output }));
      const verdict = await judgeCode(req.body.language, req.body.code, cases, {
        runnerUrl: env.JUDGE_URL
      });
      return Ok(res, 'Examples run', {
        passed: verdict.passed,
        total: verdict.total,
        error: verdict.error,
        cases: (verdict.cases || []).map((c, i) => ({
          ...c,
          input: cases[i].input,
          expected: cases[i].expectedOutput
        }))
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/course/library — everything a trainer can pick from when assembling courses
  getLibrary = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user!.role === 'admin';
      // admins see everything; trainers see what they authored
      const mine = isAdmin ? {} : { creatorId: req.user!.userId };
      const [resources, mcqs, codeQuestions, submodules, modules] = await Promise.all([
        this.resourceDao.listResources(isAdmin ? {} : { ownerId: req.user!.userId }),
        this.mcqDao.listMcqs(mine),
        this.codeQuestionDao.listQuestions(mine),
        this.submoduleDao.listSubmodules(mine),
        this.moduleDao.listModules(mine)
      ]);

      return Ok(res, 'Library fetched successfully', {
        resources: resources.map((r) => ({
          _id: r._id,
          fileName: r.fileName,
          resourceType: r.resourceType,
          mimeType: r.mimeType,
          status: r.status,
          drmStatus: r.drmStatus,
          createdAt: r.createdAt
        })),
        mcqs: mcqs.map((q) => ({ _id: q._id, question: q.question, difficulty: q.difficulty })),
        codeQuestions: codeQuestions.map((q) => ({
          _id: q._id,
          title: q.title,
          difficulty: q.difficulty,
          testCaseGenerationStatus: q.testCaseGenerationStatus
        })),
        submodules: submodules.map((s) => ({
          _id: s._id,
          title: s.title,
          description: s.description,
          itemCount: s.content.length
        })),
        modules: modules.map((m) => ({
          _id: m._id,
          title: m.title,
          description: m.description,
          durationDays: m.durationDays,
          progressRequirement: m.progressRequirement,
          submoduleCount: m.submoduleIds.length
        }))
      });
    } catch (error) {
      next(error);
    }
  };
}

export default CourseApiController;
