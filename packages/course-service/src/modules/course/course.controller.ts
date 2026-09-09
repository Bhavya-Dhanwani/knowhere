// Importing modules
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import CourseDao from '../../shared/dao/course.dao.js';
import sanitizeCourse from '../../shared/sanitizers/course.sanitizer.js';
import Ok from '../../shared/responses/Ok.response.js';
import Created from '../../shared/responses/Created.response.js';
import NotFound from '../../shared/errors/NotFound.error.js';
import {
  listActiveCourseIds,
  provisionInitialAdmin,
  requireCourseMembership
} from '../../services/courseAuthorization.service.js';
import ModuleDao from '../../shared/dao/module.dao.js';
import SubmoduleDao from '../../shared/dao/submodule.dao.js';
import ContentItemDao from '../../shared/dao/contentItem.dao.js';
import CourseProgressDao from '../../shared/dao/courseProgress.dao.js';

class CourseController {
  courseDao: CourseDao;
  moduleDao = new ModuleDao();
  submoduleDao = new SubmoduleDao();
  contentItemDao = new ContentItemDao();
  progressDao = new CourseProgressDao();

  constructor() {
    this.courseDao = new CourseDao();
  }

  createCourse = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { title, description, tags, status } = req.body;
      const instructorId = req.user!.userId;

      const course = await this.courseDao.createCourse({
        title,
        description,
        instructorId,
        tags,
        status
      });

      try {
        await provisionInitialAdmin(course._id.toString(), instructorId);
      } catch (error) {
        await this.courseDao.deleteCourseById(course._id.toString());
        throw error;
      }

      return Created(res, 'Course created successfully', sanitizeCourse(course.toObject()));
    } catch (error) {
      next(error);
    }
  };

  updateCourse = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      await requireCourseMembership(req.user!.userId, id, ['admin', 'trainer']);
      const updated = await this.courseDao.updateCourseById(id, req.body);

      if (!updated) {
        throw new NotFound(`Course with ID '${id}' not found.`);
      }

      return Ok(res, 'Course updated successfully', sanitizeCourse(updated.toObject()));
    } catch (error) {
      next(error);
    }
  };

  getCourseById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      await requireCourseMembership(req.user!.userId, id);
      const course = await this.courseDao.findCourseById(id);

      if (!course) {
        throw new NotFound(`Course with ID '${id}' not found.`);
      }

      const modules = await this.moduleDao.findModulesByCourseId(id);
      const progress = await this.progressDao.findProgress(id, req.user!.userId);
      const completionMap = new Map(
        (progress?.completedItems || []).map((entry) => [entry.contentItemId.toString(), entry])
      );
      let maxScore = 0;
      const moduleData = [];
      for (const module of modules) {
        const submodules = await this.submoduleDao.findSubmodulesByModuleId(module._id.toString());
        const submoduleData = [];
        for (const submodule of submodules) {
          const items = await this.contentItemDao.listContentItemsBySubmoduleId(
            submodule._id.toString()
          );
          const contentItems = items.map((item) => {
            maxScore += item.max_score || 0;
            const completion = completionMap.get(item._id.toString());
            return {
              id: item._id.toString(),
              title: item.title,
              type: item.type === 'notes' ? 'resource' : item.type,
              marks: item.max_score || 0,
              status: completion ? 'completed' : 'in_progress',
              earnedMarks: completion?.scoreEarned || 0
            };
          });
          submoduleData.push({
            id: submodule._id.toString(),
            title: submodule.title,
            order: submodule.order,
            status:
              contentItems.length > 0 && contentItems.every((item) => item.status === 'completed')
                ? 'completed'
                : 'in_progress',
            contentItems
          });
        }
        moduleData.push({
          id: module._id.toString(),
          title: module.title,
          order: module.order,
          submodules: submoduleData
        });
      }
      const totalSubmodules = moduleData.reduce((sum, module) => sum + module.submodules.length, 0);
      const completedSubmodules = moduleData.reduce(
        (sum, module) =>
          sum + module.submodules.filter((submodule) => submodule.status === 'completed').length,
        0
      );
      return Ok(res, 'Course fetched successfully', {
        ...sanitizeCourse(course.toObject()),
        id: course._id.toString(),
        modules: moduleData,
        totalModules: moduleData.length,
        completedModules: moduleData.filter(
          (module) =>
            module.submodules.length > 0 &&
            module.submodules.every((submodule) => submodule.status === 'completed')
        ).length,
        totalSubmodules,
        completedSubmodules,
        totalScore: progress?.totalScoreEarned || 0,
        maxScore,
        overallProgress:
          maxScore > 0 ? Math.round(((progress?.totalScoreEarned || 0) / maxScore) * 100) : 0
      });
    } catch (error) {
      next(error);
    }
  };

  listCourses = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const courseIds = await listActiveCourseIds(req.user!.userId);
      const courses = await this.courseDao.listCourses({ _id: { $in: courseIds } });
      return Ok(
        res,
        'Courses fetched successfully',
        courses.map((c) => sanitizeCourse(c.toObject()))
      );
    } catch (error) {
      next(error);
    }
  };
}

export default CourseController;
