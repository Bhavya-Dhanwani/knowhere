// Importing modules
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import CompetencyDao from '../../shared/dao/competency.dao.js';
import sanitizeCompetency from '../../shared/sanitizers/competency.sanitizer.js';
import Ok from '../../shared/responses/Ok.response.js';
import Created from '../../shared/responses/Created.response.js';
import Forbidden from '../../shared/errors/Forbidden.error.js';

// class to handle competency operations
class CompetencyController {
  competencyDao: CompetencyDao;

  constructor() {
    this.competencyDao = new CompetencyDao();
  }

  // get competencies by userId
  getCompetenciesByUserId = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const rawUserId = req.params.userId;
      const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
      const competencies = await this.competencyDao.findCompetenciesByUserId(userId);

      return Ok(
        res,
        'Competencies fetched successfully',
        competencies.map((c) => sanitizeCompetency(c.toObject()))
      );
    } catch (error) {
      next(error);
    }
  };

  // create or update competency (admin only)
  createCompetency = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // only admin can create or assign competencies
      if (req.user?.role !== 'admin') {
        throw new Forbidden('Only administrators can add competencies.');
      }

      const { userId, skill, level, score, verifiedBy } = req.body;

      const competency = await this.competencyDao.upsertCompetency({
        userId,
        skill,
        level,
        score,
        verifiedBy: verifiedBy || req.user.name || req.user.userId
      });

      return Created(
        res,
        'Competency assigned successfully',
        sanitizeCompetency(competency?.toObject())
      );
    } catch (error) {
      next(error);
    }
  };
}

export default CompetencyController;
