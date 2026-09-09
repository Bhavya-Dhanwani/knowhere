// Importing modules
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import ModuleDao from '../../shared/dao/module.dao.js';
import CourseDao from '../../shared/dao/course.dao.js';
import { requireCourseMembership } from '../../services/courseAuthorization.service.js';
import Ok from '../../shared/responses/Ok.response.js';
import Created from '../../shared/responses/Created.response.js';
import NotFound from '../../shared/errors/NotFound.error.js';

class ModuleController {
  moduleDao: ModuleDao;
  courseDao: CourseDao;

  constructor() {
    this.moduleDao = new ModuleDao();
    this.courseDao = new CourseDao();
  }

  createModule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { courseId, title, description, order } = req.body;
      if (!(await this.courseDao.findCourseById(courseId))) {
        throw new NotFound(`Course with ID '${courseId}' not found.`);
      }
      await requireCourseMembership(req.user!.userId, courseId, ['admin', 'trainer']);
      const created = await this.moduleDao.createModule({
        courseId,
        title,
        description,
        order: order || 1
      });

      return Created(res, 'Module created successfully', created.toObject());
    } catch (error) {
      next(error);
    }
  };

  updateModule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const existing = await this.moduleDao.findModuleById(id);
      if (!existing) throw new NotFound(`Module with ID '${id}' not found.`);
      await requireCourseMembership(req.user!.userId, existing.courseId.toString(), [
        'admin',
        'trainer'
      ]);
      const updated = await this.moduleDao.updateModuleById(id, req.body);

      if (!updated) {
        throw new NotFound(`Module with ID '${id}' not found.`);
      }

      return Ok(res, 'Module updated successfully', updated.toObject());
    } catch (error) {
      next(error);
    }
  };
}

export default ModuleController;
