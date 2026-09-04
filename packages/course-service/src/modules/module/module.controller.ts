// Importing modules
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import ModuleDao from '../../shared/dao/module.dao.js';
import Ok from '../../shared/responses/Ok.response.js';
import Created from '../../shared/responses/Created.response.js';
import NotFound from '../../shared/errors/NotFound.error.js';

class ModuleController {
  moduleDao: ModuleDao;

  constructor() {
    this.moduleDao = new ModuleDao();
  }

  createModule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { courseId, title, description, order } = req.body;
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
