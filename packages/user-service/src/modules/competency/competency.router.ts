// Importing modules
import express from 'express';
import CompetencyController from './competency.controller.js';
import { createCompetencyValidators, getCompetenciesValidators } from './competency.validator.js';
import authMiddleware from '../../shared/middlewares/auth.middleware.js';
import requireRole from '../../shared/middlewares/role.middleware.js';

// making the router
const router = express.Router();

// creating a competency controller instance
const competencyController = new CompetencyController();

/*
    @route GET /api/competencies/:userId
    @desc Get competencies by userId
    @access Private
*/
router.get(
  '/:userId',
  authMiddleware,
  getCompetenciesValidators,
  competencyController.getCompetenciesByUserId
);

/*
    @route POST /api/competencies
    @desc Create or assign competency to a user
    @access Admin Only
*/
router.post(
  '/',
  authMiddleware,
  requireRole('admin'),
  createCompetencyValidators,
  competencyController.createCompetency
);

export default router;
