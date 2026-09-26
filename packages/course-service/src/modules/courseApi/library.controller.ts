import { JUDGE_LANGUAGES } from '@lms/shared';
import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AuthenticatedRequest, AuthUser } from '../../shared/middlewares/auth.middleware.js';
import ResourceDao from '../../shared/dao/resource.dao.js';
import McqDao from '../../shared/dao/mcq.dao.js';
import CodeQuestionDao from '../../shared/dao/codeQuestion.dao.js';
import CourseDao from '../../shared/dao/course.dao.js';
import ModuleDao from '../../shared/dao/module.dao.js';
import SubmoduleDao from '../../shared/dao/submodule.dao.js';
import s3Service from '../../services/s3.service.js';
import { hlsPrefix } from '../../services/hls.service.js';
import { assertCanManageCourse, requireCourse } from '../../services/access.service.js';
import Ok from '../../shared/responses/Ok.response.js';
import NotFound from '../../shared/errors/NotFound.error.js';
import BadRequest from '../../shared/errors/BadRequest.error.js';
import Forbidden from '../../shared/errors/Forbidden.error.js';
import Conflict from '../../shared/errors/Conflict.error.js';

const id = (req: AuthenticatedRequest) =>
  Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

// trainers edit what they created; admins edit anything (legacy docs without an owner too)
function assertOwner(user: AuthUser, ownerId?: string | null) {
  if (user.role === 'admin' || (ownerId && ownerId === user.userId)) return;
  throw new Forbidden('You can only change content you created.');
}

// refuse to delete something still referenced, and say where
function assertUnused(kind: string, users: { title?: string; question?: string }[]) {
  if (!users.length) return;
  const names = users
    .map((u) => `"${u.title || u.question}"`)
    .slice(0, 3)
    .join(', ');
  throw new Conflict(`This ${kind} is still used by ${names}. Remove it there first.`);
}

// shared checks for the fields the library update routes accept
function assertScoring(body: { points?: unknown; referenceSolution?: unknown }) {
  if (
    body.points !== undefined &&
    !(Number.isInteger(body.points) && Number(body.points) >= 0 && Number(body.points) <= 1000)
  ) {
    throw new BadRequest('points must be a whole number from 0 to 1000.');
  }
  const ref = body.referenceSolution as { language?: unknown; code?: unknown } | null | undefined;
  if (
    ref &&
    (!(JUDGE_LANGUAGES as readonly unknown[]).includes(ref.language) ||
      typeof ref.code !== 'string' ||
      !ref.code.trim())
  ) {
    throw new BadRequest(
      `referenceSolution needs code and a language (${JUDGE_LANGUAGES.join(', ')}).`
    );
  }
}

const pick = <T extends Record<string, unknown>>(body: T, keys: (keyof T)[]) =>
  Object.fromEntries(keys.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

class LibraryController {
  private resourceDao = new ResourceDao();
  private mcqDao = new McqDao();
  private codeDao = new CodeQuestionDao();
  private courseDao = new CourseDao();
  private moduleDao = new ModuleDao();
  private submoduleDao = new SubmoduleDao();

  // ---------------------------------------------------------------- resources
  updateResource = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const r = await this.resourceDao.findResourceById(id(req));
      if (!r || r.status === 'DELETED') throw new NotFound('Resource not found.');
      assertOwner(req.user!, r.ownerId);
      const updated = await this.resourceDao.updateResourceById(
        id(req),
        pick(req.body, ['fileName'])
      );
      return Ok(res, 'Resource updated', { _id: updated!._id, fileName: updated!.fileName });
    } catch (error) {
      next(error);
    }
  };

  deleteResource = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const r = await this.resourceDao.findResourceById(id(req));
      if (!r || r.status === 'DELETED') throw new NotFound('Resource not found.');
      assertOwner(req.user!, r.ownerId);
      assertUnused('file', await this.submoduleDao.findSubmodulesUsingRef(id(req)));
      assertUnused('file', await this.mcqDao.findMcqsUsingResource(id(req)));
      await s3Service.deleteObject(r.s3Key);
      await s3Service.deletePrefix(hlsPrefix(id(req)));
      await this.resourceDao.updateResourceById(id(req), { status: 'DELETED' });
      return Ok(res, 'Resource deleted', { id: id(req) });
    } catch (error) {
      next(error);
    }
  };

  // --------------------------------------------------------------------- MCQs
  getMcqForEdit = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const q = await this.mcqDao.findMcqById(id(req));
      if (!q) throw new NotFound('MCQ not found.');
      assertOwner(req.user!, q.creatorId);
      return Ok(res, 'MCQ fetched', q);
    } catch (error) {
      next(error);
    }
  };

  updateMcq = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const q = await this.mcqDao.findMcqById(id(req));
      if (!q) throw new NotFound('MCQ not found.');
      assertOwner(req.user!, q.creatorId);
      assertScoring(req.body);

      const body = req.body as {
        question?: string;
        options?: { text: string; resourceIds?: string[] }[];
        correctOptionIndex?: number;
        explanation?: string;
        difficulty?: string;
        points?: number;
        questionResourceIds?: string[];
        explanationResourceIds?: string[];
      };
      if (body.options && body.options.length !== 4) {
        throw new BadRequest('An MCQ must contain exactly 4 options.');
      }
      const attached = [
        ...(body.questionResourceIds || []),
        ...(body.explanationResourceIds || []),
        ...(body.options || []).flatMap((o) => o.resourceIds || [])
      ];
      if (attached.length) {
        const found = await this.resourceDao.findResourcesByIds(attached);
        if (found.length !== new Set(attached).size) throw new BadRequest('Unknown attachment id.');
      }
      const toIds = (ids?: string[]) => ids?.map((x) => new Types.ObjectId(x));

      const updated = await this.mcqDao.updateMcqById(id(req), {
        ...pick(body, ['question', 'correctOptionIndex', 'explanation', 'difficulty', 'points']),
        ...(body.options && {
          options: body.options.map((o, i) => ({
            id: `option_${i}`,
            text: o.text,
            resourceIds: toIds(o.resourceIds) || []
          }))
        }),
        ...(body.questionResourceIds && { questionResourceIds: toIds(body.questionResourceIds) }),
        ...(body.explanationResourceIds && {
          explanationResourceIds: toIds(body.explanationResourceIds)
        })
      });
      return Ok(res, 'MCQ updated', { mcqId: updated!._id });
    } catch (error) {
      next(error);
    }
  };

  deleteMcq = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const q = await this.mcqDao.findMcqById(id(req));
      if (!q) throw new NotFound('MCQ not found.');
      assertOwner(req.user!, q.creatorId);
      assertUnused('MCQ', await this.submoduleDao.findSubmodulesUsingRef(id(req)));
      await this.mcqDao.deleteMcqById(id(req));
      return Ok(res, 'MCQ deleted', { id: id(req) });
    } catch (error) {
      next(error);
    }
  };

  // ------------------------------------------------------------ code questions
  getCodeQuestionForEdit = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const q = await this.codeDao.findQuestionById(id(req));
      if (!q) throw new NotFound('Coding question not found.');
      assertOwner(req.user!, q.creatorId);
      return Ok(res, 'Coding question fetched', q);
    } catch (error) {
      next(error);
    }
  };

  updateCodeQuestion = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const q = await this.codeDao.findQuestionById(id(req));
      if (!q) throw new NotFound('Coding question not found.');
      assertOwner(req.user!, q.creatorId);
      assertScoring(req.body);

      const body = req.body as { testCases?: { input: string; expectedOutput: string }[] };
      const updated = await this.codeDao.updateQuestionById(id(req), {
        ...pick(req.body, [
          'title',
          'description',
          'constraints',
          'inputFormat',
          'outputFormat',
          'examples',
          'difficulty',
          'supportedLanguages',
          'points',
          'referenceSolution'
        ]),
        ...(body.testCases && {
          testCases: body.testCases.slice(0, 100).map((t) => ({ ...t, isHidden: true }))
        })
      });
      return Ok(res, 'Coding question updated', { questionId: updated!._id });
    } catch (error) {
      next(error);
    }
  };

  deleteCodeQuestion = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const q = await this.codeDao.findQuestionById(id(req));
      if (!q) throw new NotFound('Coding question not found.');
      assertOwner(req.user!, q.creatorId);
      assertUnused('coding question', await this.submoduleDao.findSubmodulesUsingRef(id(req)));
      await this.codeDao.deleteQuestionById(id(req));
      return Ok(res, 'Coding question deleted', { id: id(req) });
    } catch (error) {
      next(error);
    }
  };

  // ---------------------------------------------------------------- submodules
  getSubmodule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const s = await this.submoduleDao.findSubmoduleById(id(req));
      if (!s) throw new NotFound('Submodule not found.');
      return Ok(res, 'Submodule fetched', s);
    } catch (error) {
      next(error);
    }
  };

  updateSubmodule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const s = await this.submoduleDao.findSubmoduleById(id(req));
      if (!s) throw new NotFound('Submodule not found.');
      assertOwner(req.user!, s.creatorId);

      const content = req.body.content as
        { type: string; resourceId?: string; contentId?: string }[] | undefined;
      const updated = await this.submoduleDao.updateSubmoduleById(id(req), {
        ...pick(req.body, ['title', 'description']),
        ...(content && {
          content: content.map((c, i) => ({
            type: c.type,
            resourceId: c.resourceId ? new Types.ObjectId(c.resourceId) : null,
            contentId: c.contentId ? new Types.ObjectId(c.contentId) : null,
            order: i + 1
          }))
        })
      });
      return Ok(res, 'Submodule updated', { submoduleId: updated!._id });
    } catch (error) {
      next(error);
    }
  };

  deleteSubmodule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const s = await this.submoduleDao.findSubmoduleById(id(req));
      if (!s) throw new NotFound('Submodule not found.');
      assertOwner(req.user!, s.creatorId);
      assertUnused('submodule', await this.moduleDao.findModulesUsingSubmodule(id(req)));
      await this.submoduleDao.deleteSubmoduleById(id(req));
      return Ok(res, 'Submodule deleted', { id: id(req) });
    } catch (error) {
      next(error);
    }
  };

  // ------------------------------------------------------------------- modules
  getModule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const m = await this.moduleDao.findModuleById(id(req));
      if (!m) throw new NotFound('Module not found.');
      return Ok(res, 'Module fetched', m);
    } catch (error) {
      next(error);
    }
  };

  updateModule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const m = await this.moduleDao.findModuleById(id(req));
      if (!m) throw new NotFound('Module not found.');
      assertOwner(req.user!, m.creatorId);

      const submoduleIds = req.body.submoduleIds as string[] | undefined;
      if (submoduleIds?.length) {
        const found = await this.submoduleDao.findSubmodulesByIds(submoduleIds);
        if (found.length !== new Set(submoduleIds).size)
          throw new BadRequest('Unknown submodule id.');
      }
      const updated = await this.moduleDao.updateModuleById(id(req), {
        ...pick(req.body, ['title', 'description', 'durationDays', 'progressRequirement']),
        ...(submoduleIds && { submoduleIds })
      });
      return Ok(res, 'Module updated', { moduleId: updated!._id });
    } catch (error) {
      next(error);
    }
  };

  deleteModule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const m = await this.moduleDao.findModuleById(id(req));
      if (!m) throw new NotFound('Module not found.');
      assertOwner(req.user!, m.creatorId);
      assertUnused('module', await this.courseDao.findCoursesUsingModule(id(req)));
      await this.moduleDao.deleteModuleById(id(req));
      return Ok(res, 'Module deleted', { id: id(req) });
    } catch (error) {
      next(error);
    }
  };

  // --------------------------------------------------------- course ↔ modules
  // POST /api/course/remove-module { courseId, moduleId }
  removeModule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const course = await requireCourse(req.body.courseId);
      await assertCanManageCourse(req.user!, course);
      await this.courseDao.removeModuleFromCourse(course._id.toString(), req.body.moduleId);
      return Ok(res, 'Module removed from course', {
        courseId: course._id,
        moduleId: req.body.moduleId
      });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/course/reorder-modules { courseId, moduleIds }
  reorderModules = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const course = await requireCourse(req.body.courseId);
      await assertCanManageCourse(req.user!, course);
      const current = course.modules.map((m) => m.moduleId.toString()).sort();
      const wanted = [...(req.body.moduleIds as string[])].sort();
      if (current.join() !== wanted.join()) {
        throw new BadRequest('moduleIds must list exactly the modules already in the course.');
      }
      await this.courseDao.reorderModules(course._id.toString(), req.body.moduleIds);
      return Ok(res, 'Modules reordered', { courseId: course._id });
    } catch (error) {
      next(error);
    }
  };
}

export default LibraryController;
