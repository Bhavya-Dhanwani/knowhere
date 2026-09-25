// Importing modules
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import ContentItemDao from '../../shared/dao/contentItem.dao.js';
import sanitizeContentItem from '../../shared/sanitizers/contentItem.sanitizer.js';
import externalContentService from '../../services/externalContent.service.js';
import Ok from '../../shared/responses/Ok.response.js';
import NotFound from '../../shared/errors/NotFound.error.js';

class ContentItemController {
  contentItemDao: ContentItemDao;

  constructor() {
    this.contentItemDao = new ContentItemDao();
  }

  // GET /content-items/:id � detail call
  getContentItemDetail = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;

      const item = await this.contentItemDao.findContentItemById(id);
      if (!item) {
        throw new NotFound(`Content item with ID '${id}' not found.`);
      }

      const details = await externalContentService.fetchItemDetail(
        item.type as import('../../shared/models/contentItem.model.js').ContentItemType,
        item.ref_id.toString()
      );

      return Ok(res, 'Content item details fetched successfully', {
        item: sanitizeContentItem(item.toObject()),
        details
      });
    } catch (error) {
      next(error);
    }
  };

  // PUT /content-items/:id � update marks/metadata
  updateContentItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const { title, max_score, order } = req.body;

      const updated = await this.contentItemDao.updateContentItemById(id, {
        ...(title !== undefined && { title }),
        ...(max_score !== undefined && { max_score: Number(max_score) }),
        ...(order !== undefined && { order: Number(order) })
      });

      if (!updated) {
        throw new NotFound(`Content item with ID '${id}' not found.`);
      }

      return Ok(res, 'Content item updated successfully', sanitizeContentItem(updated.toObject()));
    } catch (error) {
      next(error);
    }
  };
}

export default ContentItemController;
