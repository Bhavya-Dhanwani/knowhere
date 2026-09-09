// Importing modules
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import CourseProgressDao from '../../shared/dao/courseProgress.dao.js';
import ContentItemDao from '../../shared/dao/contentItem.dao.js';
import CourseDao from '../../shared/dao/course.dao.js';
import ModuleDao from '../../shared/dao/module.dao.js';
import SubmoduleDao from '../../shared/dao/submodule.dao.js';
import Ok from '../../shared/responses/Ok.response.js';
import NotFound from '../../shared/errors/NotFound.error.js';
import BadRequest from '../../shared/errors/BadRequest.error.js';
import { requireCourseMembership } from '../../services/courseAuthorization.service.js';

class ProgressController {
  progressDao: CourseProgressDao;
  contentItemDao: ContentItemDao;
  courseDao: CourseDao;
  moduleDao: ModuleDao;
  submoduleDao: SubmoduleDao;

  constructor() {
    this.progressDao = new CourseProgressDao();
    this.contentItemDao = new ContentItemDao();
    this.courseDao = new CourseDao();
    this.moduleDao = new ModuleDao();
    this.submoduleDao = new SubmoduleDao();
  }

  // Calculate total possible score for an entire course
  private async calculateCourseMaxScore(courseId: string): Promise<number> {
    const modules = await this.moduleDao.findModulesByCourseId(courseId);
    let totalMaxScore = 0;

    for (const mod of modules) {
      const submodules = await this.submoduleDao.findSubmodulesByModuleId(mod._id.toString());
      for (const sub of submodules) {
        const items = await this.contentItemDao.listContentItemsBySubmoduleId(sub._id.toString());
        for (const item of items) {
          totalMaxScore += item.max_score || 0;
        }
      }
    }
    return totalMaxScore;
  }

  // POST /api/courses/:courseId/content-items/:itemId/complete
  // Student completes video/notes or submits marks for an item
  completeItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawCourseId = req.params.courseId;
      const courseId = Array.isArray(rawCourseId) ? rawCourseId[0] : rawCourseId;
      const rawItemId = req.params.itemId;
      const itemId = Array.isArray(rawItemId) ? rawItemId[0] : rawItemId;
      const userId = req.user!.userId;

      // verify course exists
      const course = await this.courseDao.findCourseById(courseId);
      if (!course) {
        throw new NotFound(`Course with ID '${courseId}' not found.`);
      }

      // verify content item exists
      const item = await this.contentItemDao.findContentItemById(itemId);
      if (!item) {
        throw new NotFound(`Content item with ID '${itemId}' not found.`);
      }

      const submodule = await this.submoduleDao.findSubmoduleById(item.submoduleId.toString());
      if (!submodule) throw new NotFound('Parent submodule not found.');
      const parentModule = await this.moduleDao.findModuleById(submodule.moduleId.toString());
      if (!parentModule || parentModule.courseId.toString() !== courseId) {
        throw new BadRequest('Content item does not belong to the specified course.');
      }
      await requireCourseMembership(userId, courseId);

      if (item.type === 'mcq' || item.type === 'coding') {
        throw new BadRequest('Assessment scores must be recorded by the assessment service.');
      }

      // determine marks to reward
      let scoreToAward = item.max_score || 0;

      const progress = await this.progressDao.recordCompletion({
        courseId,
        userId,
        contentItemId: itemId,
        type: item.type as any,
        scoreEarned: scoreToAward,
        maxScore: item.max_score || 0
      });

      const courseMaxScore = await this.calculateCourseMaxScore(courseId);

      return Ok(res, 'Item completed and marks awarded successfully', {
        itemId,
        type: item.type,
        scoreAwarded: scoreToAward,
        itemMaxScore: item.max_score || 0,
        totalScoreEarned: progress.totalScoreEarned,
        courseMaxScore,
        percentage:
          courseMaxScore > 0 ? ((progress.totalScoreEarned / courseMaxScore) * 100).toFixed(1) : '0'
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/courses/:courseId/my-progress
  getMyProgress = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawCourseId = req.params.courseId;
      const courseId = Array.isArray(rawCourseId) ? rawCourseId[0] : rawCourseId;
      const userId = req.user!.userId;

      await requireCourseMembership(userId, courseId);

      const progress = await this.progressDao.findProgress(courseId, userId);
      const courseMaxScore = await this.calculateCourseMaxScore(courseId);

      const totalEarned = progress ? progress.totalScoreEarned : 0;
      const completedItems = progress ? progress.completedItems : [];

      return Ok(res, 'Course progress fetched successfully', {
        courseId,
        userId,
        totalScoreEarned: totalEarned,
        courseMaxScore,
        percentage: courseMaxScore > 0 ? ((totalEarned / courseMaxScore) * 100).toFixed(1) : '0',
        completedItemsCount: completedItems.length,
        completedItems
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/courses/:courseId/grades (Trainer / Admin only)
  getCourseGrades = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawCourseId = req.params.courseId;
      const courseId = Array.isArray(rawCourseId) ? rawCourseId[0] : rawCourseId;

      await requireCourseMembership(req.user!.userId, courseId, ['admin', 'trainer']);

      const course = await this.courseDao.findCourseById(courseId);
      if (!course) {
        throw new NotFound(`Course with ID '${courseId}' not found.`);
      }

      const grades = await this.progressDao.listGradesByCourse(courseId);
      const courseMaxScore = await this.calculateCourseMaxScore(courseId);

      return Ok(res, 'Course grades fetched successfully', {
        courseId,
        courseTitle: course.title,
        courseMaxScore,
        totalStudents: grades.length,
        grades: grades.map((g) => ({
          userId: g.userId,
          totalScoreEarned: g.totalScoreEarned,
          percentage:
            courseMaxScore > 0 ? ((g.totalScoreEarned / courseMaxScore) * 100).toFixed(1) : '0',
          completedCount: g.completedItems.length
        }))
      });
    } catch (error) {
      next(error);
    }
  };
}

export default ProgressController;
