// Importing modules
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import SubmoduleDao from '../../shared/dao/submodule.dao.js';
import ContentItemDao from '../../shared/dao/contentItem.dao.js';
import sanitizeContentItem from '../../shared/sanitizers/contentItem.sanitizer.js';
import externalContentService from '../../services/externalContent.service.js';
import Ok from '../../shared/responses/Ok.response.js';
import Created from '../../shared/responses/Created.response.js';
import NotFound from '../../shared/errors/NotFound.error.js';

class SubmoduleController {
  submoduleDao: SubmoduleDao;
  contentItemDao: ContentItemDao;

  constructor() {
    this.submoduleDao = new SubmoduleDao();
    this.contentItemDao = new ContentItemDao();
  }

  createSubmodule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { moduleId, title, order } = req.body;
      const created = await this.submoduleDao.createSubmodule({
        moduleId,
        title,
        order: order || 1
      });

      return Created(res, 'Submodule created successfully', created.toObject());
    } catch (error) {
      next(error);
    }
  };

  updateSubmodule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const updated = await this.submoduleDao.updateSubmoduleById(id, req.body);

      if (!updated) {
        throw new NotFound(`Submodule with ID '${id}' not found.`);
      }

      return Ok(res, 'Submodule updated successfully', updated.toObject());
    } catch (error) {
      next(error);
    }
  };

  // POST /submodules/:id/content-items — attach endpoint
  // Calls target module service to validate ref_id and pull denormalized title/max_score
  attachContentItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const submoduleId = Array.isArray(rawId) ? rawId[0] : rawId;

      // verify submodule exists
      const submodule = await this.submoduleDao.findSubmoduleById(submoduleId);
      if (!submodule) {
        throw new NotFound(`Submodule with ID '${submoduleId}' not found.`);
      }

      const { type, ref_id, order, max_score } = req.body;

      // call external content service to validate ref_id and fetch denormalized metadata
      const refData = await externalContentService.validateAndFetchReference(type, ref_id);

      // if trainer specifies custom max_score, override target module default
      const finalMaxScore = max_score !== undefined ? Number(max_score) : refData.max_score;

      // write ContentItem
      const item = await this.contentItemDao.createContentItem({
        submoduleId,
        type,
        ref_id,
        title: refData.title,
        max_score: finalMaxScore,
        order: order || 1
      });

      return Created(
        res,
        'Content item attached successfully',
        sanitizeContentItem(item.toObject())
      );
    } catch (error) {
      next(error);
    }
  };

  // GET /submodules/:id/content-items — cheap list call for sidebar
  // Single collection query, no cross-module calls
  listContentItems = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const submoduleId = Array.isArray(rawId) ? rawId[0] : rawId;

      const items = await this.contentItemDao.listContentItemsBySubmoduleId(submoduleId);

      return Ok(
        res,
        'Content items fetched successfully',
        items.map((i) => sanitizeContentItem(i.toObject()))
      );
    } catch (error) {
      next(error);
    }
  };
}

export default SubmoduleController;
