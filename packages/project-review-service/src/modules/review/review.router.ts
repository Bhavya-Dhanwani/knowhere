import express from 'express';
import ReviewController from './review.controller.js';
import {
  createEventValidators,
  updateEventValidators,
  createSubmissionValidators,
  updateSubmissionValidators,
  submissionIdValidators,
  eventIdValidators,
  judgeOverrideValidators
} from './review.validator.js';
import validate from '../../shared/middlewares/validate.middleware.js';
import authMiddleware from '../../shared/middlewares/auth.middleware.js';
import requireRole from '../../shared/middlewares/role.middleware.js';

const router = express.Router();
const controller = new ReviewController();

// Public candidate flow: event instructions and submission intake only.
router.get('/events/:id', eventIdValidators, validate, controller.getEvent);
router.post(
  '/events/:id/submissions',
  createSubmissionValidators,
  validate,
  controller.submitProject
);

router.use(authMiddleware);

/*
  ==================== EVENTS ====================
*/

// POST /api/review/events - Create new review event with fixed criteria & rubrics
router.post(
  '/events',
  requireRole('instructor', 'judge'),
  createEventValidators,
  validate,
  controller.createEvent
);

// GET /api/review/events - List all review events
router.get('/events', controller.listEvents);

// GET /api/review/events/:id - Get event details

// PUT /api/review/events/:id - Update event details
router.put(
  '/events/:id',
  requireRole('instructor', 'judge'),
  updateEventValidators,
  validate,
  controller.updateEvent
);

/*
  ==================== SUBMISSIONS ====================
*/

// POST /api/review/events/:id/submissions - Submit a project repository for review

// GET /api/review/events/:id/submissions - List all submissions for an event
router.get(
  '/events/:id/submissions',
  eventIdValidators,
  validate,
  controller.listSubmissionsForEvent
);

// GET /api/review/submissions/:id - Get submission details
router.get('/submissions/:id', submissionIdValidators, validate, controller.getSubmission);

// PUT /api/review/submissions/:id - Update submission details
router.put(
  '/submissions/:id',
  requireRole('instructor', 'judge'),
  updateSubmissionValidators,
  validate,
  controller.updateSubmission
);

// DELETE /api/review/submissions/:id - Delete a submission
router.delete(
  '/submissions/:id',
  requireRole('instructor', 'judge'),
  submissionIdValidators,
  validate,
  controller.deleteSubmission
);

/*
  ==================== EVALUATION & DURABLE WORKFLOWS ====================
*/

// POST /api/review/submissions/:id/evaluate - Dispatch durable evaluation workflow
router.post(
  '/submissions/:id/evaluate',
  requireRole('instructor', 'judge'),
  submissionIdValidators,
  validate,
  controller.evaluateSubmission
);

// GET /api/review/submissions/:id/status - Check evaluation status
router.get(
  '/submissions/:id/status',
  submissionIdValidators,
  validate,
  controller.getEvaluationStatus
);

/*
  ==================== SANITIZATION & AUDIT ====================
*/

// GET /api/review/submissions/:id/audit - View injection detection & sanitization audit
router.get(
  '/submissions/:id/audit',
  submissionIdValidators,
  validate,
  controller.getSanitizationAudit
);

/*
  ==================== REPORTS & EVIDENCE ====================
*/

// GET /api/review/submissions/:id/report - Full evaluation report (scores, evidence, audit)
router.get(
  '/submissions/:id/report',
  submissionIdValidators,
  validate,
  controller.getEvaluationReport
);

// GET /api/review/submissions/:id/export-pdf - Metadata for Playwright print-to-pdf export
router.get(
  '/submissions/:id/export-pdf',
  submissionIdValidators,
  validate,
  controller.exportReportPdfMetadata
);

/*
  ==================== EVALUATION REPLAY (§20) ====================
*/

// GET /api/review/submissions/:id/replay - Complete replay trace of durable activity steps
router.get(
  '/submissions/:id/replay',
  submissionIdValidators,
  validate,
  controller.getEvaluationReplay
);

/*
  ==================== RANKING & PAIRWISE ====================
*/

// POST /api/review/events/:id/rank - Run Bradley-Terry relative pairwise ranking for an event
router.post(
  '/events/:id/rank',
  requireRole('instructor', 'judge'),
  eventIdValidators,
  validate,
  controller.computeEventRanking
);

router.get(
  '/submissions/:id/report.csv',
  submissionIdValidators,
  validate,
  controller.exportReportCsv
);

router.get(
  '/submissions/:id/report.md',
  submissionIdValidators,
  validate,
  controller.exportReportMarkdown
);

// GET /api/review/events/:id/leaderboard - Relative ranking leaderboard
router.get('/events/:id/leaderboard', eventIdValidators, validate, controller.getLeaderboard);

// GET /api/review/events/:id/pairwise - Pairwise comparison matrix & rationales
router.get('/events/:id/pairwise', eventIdValidators, validate, controller.getPairwiseMatrix);

/*
  ==================== JUDGE OVERRIDE ====================
*/

// POST /api/review/submissions/:id/override - Override score with mandatory audit reason
router.post(
  '/submissions/:id/override',
  requireRole('judge'),
  judgeOverrideValidators,
  validate,
  controller.judgeOverrideScore
);

export default router;
