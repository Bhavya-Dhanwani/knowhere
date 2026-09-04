// Importing modules
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import CourseDao from '../../shared/dao/course.dao.js';
import sanitizeCourse from '../../shared/sanitizers/course.sanitizer.js';
import Ok from '../../shared/responses/Ok.response.js';
import Created from '../../shared/responses/Created.response.js';
import NotFound from '../../shared/errors/NotFound.error.js';

class CourseController {
  courseDao: CourseDao;

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

      return Created(res, 'Course created successfully', sanitizeCourse(course.toObject()));
    } catch (error) {
      next(error);
    }
  };

  updateCourse = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
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
      const course = await this.courseDao.findCourseById(id);

      if (!course) {
        throw new NotFound(`Course with ID '${id}' not found.`);
      }

      return Ok(res, 'Course fetched successfully', sanitizeCourse(course.toObject()));
    } catch (error) {
      next(error);
    }
  };

  listCourses = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const courses = await this.courseDao.listCourses();
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
