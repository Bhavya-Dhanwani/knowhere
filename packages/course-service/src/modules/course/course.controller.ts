// Importing modules
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import CourseDao from '../../shared/dao/course.dao.js';
import CourseProgressDao from '../../shared/dao/courseProgress.dao.js';
import sanitizeCourse from '../../shared/sanitizers/course.sanitizer.js';
import { loadCourseOutline, outlineItems } from '../../services/courseOutline.service.js';
import Forbidden from '../../shared/errors/Forbidden.error.js';
import {
  assertCanManageCourse,
  memberships,
  openCourse,
  requireCourse
} from '../../services/access.service.js';
import Ok from '../../shared/responses/Ok.response.js';

const param = (v: string | string[]) => (Array.isArray(v) ? v[0] : v);

// Course reads for the UI plus update/delete. Creating courses lives in /api/course.
class CourseController {
  courseDao = new CourseDao();
  progressDao = new CourseProgressDao();

  updateCourse = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const course = await requireCourse(param(req.params.id));
      await assertCanManageCourse(req.user!, course);
      const { title, description, status } = req.body;
      const updated = await this.courseDao.updateCourseById(course._id.toString(), {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status })
      });
      return Ok(res, 'Course updated successfully', sanitizeCourse(updated!.toObject()));
    } catch (error) {
      next(error);
    }
  };

  // DELETE /courses/:id — removes the course and its learner progress. Library content
  // (modules, submodules, questions, files) stays reusable.
  deleteCourse = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const course = await requireCourse(param(req.params.id));
      await assertCanManageCourse(req.user!, course);
      await this.progressDao.deleteByCourse(course._id.toString());
      await this.courseDao.deleteCourseById(course._id.toString());
      memberships.forget(course._id.toString());
      return Ok(res, 'Course deleted successfully', { id: course._id.toString() });
    } catch (error) {
      next(error);
    }
  };

  getCourseById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const course = await requireCourse(param(req.params.id));
      return Ok(res, 'Course fetched successfully', sanitizeCourse(course.toObject()));
    } catch (error) {
      next(error);
    }
  };

  // learners only see published courses; staff see everything
  listCourses = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const staff = req.user!.role === 'admin' || req.user!.role === 'trainer';
      const courses = await this.courseDao.listCourses(staff ? {} : { status: 'published' });
      return Ok(
        res,
        'Courses fetched successfully',
        courses.map((c) => sanitizeCourse(c.toObject()))
      );
    } catch (error) {
      next(error);
    }
  };

  // GET /courses/:id/structure — enrolled learners and course staff only
  getStructure = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      let view;
      try {
        view = await openCourse(req.user!, param(req.params.id));
      } catch (err) {
        // not enrolled in a published course: show the syllabus, every module locked
        const course = err instanceof Forbidden ? await requireCourse(param(req.params.id)) : null;
        if (!course || course.status !== 'published') throw err;
        const outline = await loadCourseOutline(course);
        const items = outlineItems(outline);
        return Ok(res, 'Course preview fetched successfully', {
          course: sanitizeCourse(course.toObject()),
          canManage: false,
          enrolled: false,
          joinedAt: null,
          modules: outline.map((m) => ({
            ...m,
            schedule: {
              startsAt: m.releaseAt,
              deadline: null,
              released: false,
              locked: true,
              completedPercent: 0
            },
            submodules: m.submodules.map((s) => ({
              ...s,
              items: s.items.map((it) => ({
                _id: it._id,
                type: it.type,
                title: it.title,
                maxScore: it.maxScore,
                meta: {},
                completed: false,
                scoreEarned: 0
              }))
            }))
          })),
          stats: {
            moduleCount: outline.length,
            lessonCount: outline.reduce((n, m) => n + m.submodules.length, 0),
            itemCount: items.length,
            completedCount: 0,
            totalScoreEarned: 0,
            maxScore: items.reduce((n, it) => n + it.maxScore, 0)
          }
        });
      }
      const progress = await this.progressDao.findProgress(
        view.course._id.toString(),
        req.user!.userId
      );
      const done = new Map(
        (progress?.completedItems || []).map((c) => [c.contentItemId.toString(), c.scoreEarned])
      );

      const now = new Date();
      const modules = view.outline.map((m, i) => ({
        ...m,
        schedule: {
          startsAt: view.schedule[i].startsAt,
          deadline: view.schedule[i].deadline,
          released: view.schedule[i].released,
          locked: !view.manager && now < view.schedule[i].startsAt,
          completedPercent: Math.round(view.schedule[i].completedPercent)
        },
        submodules: m.submodules.map((s) => ({
          ...s,
          items: s.items.map((it) => ({
            ...it,
            completed: done.has(it._id),
            scoreEarned: done.get(it._id) ?? 0
          }))
        }))
      }));

      const items = outlineItems(view.outline);
      return Ok(res, 'Course structure fetched successfully', {
        course: sanitizeCourse(view.course.toObject()),
        canManage: view.manager,
        enrolled: true,
        joinedAt: view.joinedAt,
        modules,
        stats: {
          moduleCount: view.outline.length,
          lessonCount: view.outline.reduce((n, m) => n + m.submodules.length, 0),
          itemCount: items.length,
          completedCount: items.filter((it) => done.has(it._id)).length,
          totalScoreEarned: progress?.totalScoreEarned || 0,
          maxScore: items.reduce((n, it) => n + it.maxScore, 0)
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

export default CourseController;
