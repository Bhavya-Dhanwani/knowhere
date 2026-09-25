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
import mistralGeneratorService from '../../services/mistralGenerator.service.js';
import activityAnalysisService from '../../services/activityAnalysis.service.js';
import Ok from '../../shared/responses/Ok.response.js';
import Created from '../../shared/responses/Created.response.js';
import NotFound from '../../shared/errors/NotFound.error.js';
import BadRequest from '../../shared/errors/BadRequest.error.js';
import Forbidden from '../../shared/errors/Forbidden.error.js';
import logger from '../../shared/config/logger.config.js';

class CourseApiController {
  private resourceDao: ResourceDao;
  private mcqDao: McqDao;
  private mcqAttemptDao: McqAttemptDao;
  private codeQuestionDao: CodeQuestionDao;
  private courseDao: CourseDao;
  private moduleDao: ModuleDao;
  private submoduleDao: SubmoduleDao;

  constructor() {
    this.resourceDao = new ResourceDao();
    this.mcqDao = new McqDao();
    this.mcqAttemptDao = new McqAttemptDao();
    this.codeQuestionDao = new CodeQuestionDao();
    this.courseDao = new CourseDao();
    this.moduleDao = new ModuleDao();
    this.submoduleDao = new SubmoduleDao();
  }

  // 1. POST /api/course/upload-resource
  uploadResource = async (req: UploadResourceRequest, res: Response, next: NextFunction) => {
    try {
      const { fileName, mimeType, fileSize, resourceType, courseId, submoduleId } = req.body;
      const ownerId = req.user!.userId;

      // Verify course exists
      const course = await this.courseDao.findCourseById(courseId);
      if (!course) {
        throw new NotFound(`Course with ID '${courseId}' not found.`);
      }

      // Check course ownership / trainer permission
      if (req.user!.role !== 'admin' && course.instructorId !== ownerId) {
        throw new Forbidden('You do not have permission to upload resources to this course.');
      }

      // Validate submodule if provided
      if (submoduleId) {
        const sub = await this.submoduleDao.findSubmoduleById(submoduleId);
        if (!sub) {
          throw new NotFound(`Submodule with ID '${submoduleId}' not found.`);
        }
      }

      // Generate unique S3 object key
      const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniqueKey = `courses/${courseId}/resources/${randomUUID()}-${cleanFileName}`;
      const isVideo = resourceType === 'video';

      // Create resource record in database with pending status
      const resource = await this.resourceDao.createResource({
        fileName,
        mimeType,
        fileSizeBytes: Number(fileSize),
        resourceType,
        courseId: new Types.ObjectId(courseId),
        submoduleId: submoduleId ? new Types.ObjectId(submoduleId) : null,
        ownerId,
        s3Key: uniqueKey,
        status: 'PENDING_UPLOAD',
        drmStatus: isVideo ? 'DRM_PENDING' : undefined
      });

      // Generate short-lived presigned upload URL
      const uploadUrl = await s3Service.generateUploadUrl(uniqueKey, mimeType, 900);

      // If video, schedule DRM background worker to monitor upload
      if (isVideo) {
        drmWorkerService.enqueueVideoDrmJob(resource._id.toString(), uniqueKey);
      }

      return Ok(res, 'Upload URL generated', {
        resourceId: resource._id.toString(),
        uploadUrl,
        s3Key: uniqueKey,
        expiresIn: 900,
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
        questionResourceIds,
        explanationResourceIds,
        tags,
        difficulty,
        courseId
      } = req.body;
      const creatorId = req.user!.userId;

      if (!options || options.length !== 4) {
        throw new BadRequest('An MCQ must contain exactly 4 options.');
      }

      if (correctOptionIndex < 0 || correctOptionIndex > 3) {
        throw new BadRequest('correctOptionIndex must be an integer between 0 and 3.');
      }

      // Map options with stable IDs
      const mappedOptions = options.map((opt, idx) => ({
        id: `option_${idx}`,
        text: opt.text,
        resourceIds: (opt.resourceIds || []).map((id) => new Types.ObjectId(id))
      }));

      const qResIds = (questionResourceIds || []).map((id) => new Types.ObjectId(id));
      const expResIds = (explanationResourceIds || []).map((id) => new Types.ObjectId(id));

      const mcq = await this.mcqDao.createMcq({
        question,
        options: mappedOptions,
        correctOptionIndex,
        explanation: explanation || '',
        questionResourceIds: qResIds,
        explanationResourceIds: expResIds,
        tags: tags || [],
        difficulty: difficulty || 'easy',
        creatorId,
        courseId: courseId ? new Types.ObjectId(courseId) : null
      });

      return Created(res, 'MCQ created successfully', {
        mcqId: mcq._id.toString()
      });
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
        examples,
        difficulty,
        supportedLanguages,
        courseId,
        testCaseGeneration
      } = req.body;
      const creatorId = req.user!.userId;

      const publicExamples = (examples || []).slice(0, 5);
      let generationStatus: 'NOT_REQUESTED' | 'PENDING' | 'COMPLETED' | 'FAILED' = 'NOT_REQUESTED';
      let hiddenTestCases: { input: string; expectedOutput: string; isHidden: boolean }[] = [];

      if (testCaseGeneration?.enabled) {
        generationStatus = 'COMPLETED';
        const aiResult = await mistralGeneratorService.generateTestCases({
          title,
          description,
          constraints,
          inputFormat,
          outputFormat,
          examples: publicExamples,
          requestedCount: testCaseGeneration.requestedCount || 10
        });

        hiddenTestCases = aiResult.testCases;
      }

      const question = await this.codeQuestionDao.createQuestion({
        title,
        description,
        constraints,
        inputFormat,
        outputFormat,
        examples: publicExamples,
        difficulty: difficulty || 'easy',
        supportedLanguages: supportedLanguages || ['javascript', 'python', 'cpp', 'c'],
        testCases: hiddenTestCases,
        testCaseGenerationStatus: generationStatus,
        creatorId,
        courseId: courseId ? new Types.ObjectId(courseId) : null
      });

      const hiddenCount = hiddenTestCases.filter((tc) => tc.isHidden).length;

      return Created(res, 'Coding question created', {
        questionId: question._id.toString(),
        testCaseGenerationStatus: generationStatus,
        publicExampleCount: publicExamples.length,
        hiddenTestCaseCount: hiddenCount
      });
    } catch (error) {
      next(error);
    }
  };

  // 4. POST /api/course/submodule
  createSubmodule = async (req: CreateSubmoduleRequest, res: Response, next: NextFunction) => {
    try {
      const { title, description, courseId, moduleId, content } = req.body;

      const course = await this.courseDao.findCourseById(courseId);
      if (!course) {
        throw new NotFound(`Course with ID '${courseId}' not found.`);
      }

      if (moduleId) {
        const mod = await this.moduleDao.findModuleById(moduleId);
        if (!mod) {
          throw new NotFound(`Module with ID '${moduleId}' not found.`);
        }
      }

      const mappedContent = (content || []).map((c, idx) => ({
        type: c.type,
        resourceId: c.resourceId ? new Types.ObjectId(c.resourceId) : null,
        contentId: c.contentId ? new Types.ObjectId(c.contentId) : null,
        order: c.order || idx + 1
      }));

      const submodule = await this.submoduleDao.createSubmodule({
        title,
        description: description || '',
        courseId,
        moduleId: moduleId || null,
        order: 1,
        content: mappedContent
      });

      return Created(res, 'Submodule created successfully', {
        submoduleId: submodule._id.toString()
      });
    } catch (error) {
      next(error);
    }
  };

  // 5. POST /api/course/module
  createModule = async (req: CreateModuleRequest, res: Response, next: NextFunction) => {
    try {
      const {
        title,
        description,
        courseId,
        submoduleIds,
        durationDays,
        releasePolicy,
        progressRequirement
      } = req.body;

      const parsedSubmoduleIds = (submoduleIds || []).map((id) => new Types.ObjectId(id));

      // Validate submodules exist
      if (parsedSubmoduleIds.length > 0) {
        const found = await this.submoduleDao.findSubmodulesByIds(
          parsedSubmoduleIds.map((id) => id.toString())
        );
        if (found.length !== parsedSubmoduleIds.length) {
          throw new BadRequest('One or more referenced submoduleIds do not exist.');
        }
      }

      const createdModule = await this.moduleDao.createModule({
        title,
        description: description || '',
        courseId: courseId || null,
        submoduleIds: parsedSubmoduleIds.map((id) => id.toString()),
        durationDays: Number(durationDays),
        releasePolicy: releasePolicy
          ? {
              type: releasePolicy.type,
              unlockAt: releasePolicy.unlockAt ? new Date(releasePolicy.unlockAt) : null,
              releaseAt: releasePolicy.releaseAt ? new Date(releasePolicy.releaseAt) : null,
              allowLateJoinerCatchUp: releasePolicy.allowLateJoinerCatchUp ?? true
            }
          : undefined,
        progressRequirement: progressRequirement !== undefined ? Number(progressRequirement) : 70
      });

      return Created(res, 'Module created successfully', {
        moduleId: createdModule._id.toString()
      });
    } catch (error) {
      next(error);
    }
  };

  // 6. POST /api/course
  createCourse = async (req: CreateCourseRequest, res: Response, next: NextFunction) => {
    try {
      const { title, description, modules, status, settings } = req.body;
      const instructorId = req.user!.userId;

      const course = await this.courseDao.createCourse({
        title,
        description: description || '',
        instructorId,
        status: status || 'draft',
        modules: (modules || []).map((modId, idx) => ({
          moduleId: new Types.ObjectId(modId),
          order: idx + 1,
          releasePolicy: {
            type: 'immediate',
            allowLateJoinerCatchUp: true
          }
        })),
        settings: {
          allowLateEnrollment: settings?.allowLateEnrollment ?? true,
          defaultModuleDurationDays: settings?.defaultModuleDurationDays ?? 7,
          progressionThreshold: settings?.progressionThreshold ?? 70
        }
      });

      return Created(res, 'Course created successfully', {
        courseId: course._id.toString(),
        status: course.status
      });
    } catch (error) {
      next(error);
    }
  };

  // 7. POST /api/course/add-module
  addModule = async (req: AddModuleRequest, res: Response, next: NextFunction) => {
    try {
      const { courseId, moduleId, order, releasePolicy } = req.body;

      const course = await this.courseDao.findCourseById(courseId);
      if (!course) {
        throw new NotFound(`Course with ID '${courseId}' not found.`);
      }

      const moduleDoc = await this.moduleDao.findModuleById(moduleId);
      if (!moduleDoc) {
        throw new NotFound(`Module with ID '${moduleId}' not found.`);
      }

      await this.courseDao.addModuleToCourse(courseId, {
        moduleId: new Types.ObjectId(moduleId),
        order: Number(order),
        releasePolicy: releasePolicy
          ? {
              type: releasePolicy.type,
              releaseAt: releasePolicy.releaseAt ? new Date(releasePolicy.releaseAt) : null,
              allowLateJoinerCatchUp: releasePolicy.allowLateJoinerCatchUp ?? true
            }
          : { type: 'immediate', allowLateJoinerCatchUp: true }
      });

      return Created(res, 'Module added to course successfully', {
        courseId,
        moduleId,
        order: Number(order)
      });
    } catch (error) {
      next(error);
    }
  };

  // 8. GET /api/course/mcq/:id
  getMcq = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const mcq = await this.mcqDao.findMcqById(id);

      if (!mcq) {
        throw new NotFound(`MCQ with ID '${id}' not found.`);
      }

      // Strip correct answer, explanation, and internal keys for learner safety
      return res.status(200).json({
        question: mcq.question,
        options: mcq.options.map((opt) => ({
          id: opt.id,
          text: opt.text
        }))
      });
    } catch (error) {
      next(error);
    }
  };

  // 9. GET /api/course/video/:id
  streamVideo = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const resource = await this.resourceDao.findResourceById(id);

      if (!resource) {
        throw new NotFound(`Video resource with ID '${id}' not found.`);
      }

      if (resource.resourceType !== 'video') {
        throw new BadRequest('Requested resource is not a video.');
      }

      if (resource.status === 'DELETED') {
        throw new NotFound('Resource has been deleted.');
      }

      // Log verified user streaming request
      const userEmail = req.user!.email || 'authenticated-trainee@knowhere.dev';
      logger.info({ resourceId: id, userEmail }, 'Secure video chunk streaming requested');

      const rangeHeader = req.headers.range;
      await videoStreamService.streamVideoChunk(res, {
        rangeHeader,
        s3Key: resource.s3Key,
        fileSizeBytes: resource.fileSizeBytes,
        mimeType: resource.mimeType
      });
    } catch (error) {
      next(error);
    }
  };

  // 10. GET /api/course/resource/:id
  getResource = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const resource = await this.resourceDao.findResourceById(id);

      if (!resource) {
        throw new NotFound(`Resource with ID '${id}' not found.`);
      }

      if (resource.status === 'DELETED') {
        throw new NotFound('Resource has been deleted.');
      }

      // Generate secure short-lived presigned download URL
      const downloadUrl = await s3Service.generateDownloadUrl(resource.s3Key, undefined, 300);

      return Ok(res, 'Resource fetched successfully', {
        resourceId: resource._id.toString(),
        fileName: resource.fileName,
        mimeType: resource.mimeType,
        downloadUrl,
        expiresIn: 300
      });
    } catch (error) {
      next(error);
    }
  };

  // 11. POST /api/course/chk-mcq
  checkMcq = async (req: CheckMcqRequest, res: Response, next: NextFunction) => {
    try {
      const { mcqId, selectedOptionId } = req.body;
      const userId = req.user!.userId;

      const mcq = await this.mcqDao.findMcqById(mcqId);
      if (!mcq) {
        throw new NotFound(`MCQ with ID '${mcqId}' not found.`);
      }

      // Determine correct option
      const correctOption = mcq.options[mcq.correctOptionIndex];
      const isCorrect =
        correctOption &&
        (selectedOptionId === correctOption.id ||
          selectedOptionId === `option_${mcq.correctOptionIndex}`);

      const attemptNumber = (await this.mcqAttemptDao.getAttemptCount(mcqId, userId)) + 1;

      // Record attempt in database
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

      // Log learner activity
      if (mcq.courseId) {
        await activityAnalysisService.logEvent(
          userId,
          mcq.courseId.toString(),
          isCorrect ? 'MCQ_ANSWERED_CORRECT' : 'MCQ_ANSWERED_INCORRECT',
          { mcqId, isCorrect, attemptNumber }
        );
      }

      return Ok(res, 'MCQ evaluation completed', {
        isCorrect
      });
    } catch (error) {
      next(error);
    }
  };
}

export default CourseApiController;
