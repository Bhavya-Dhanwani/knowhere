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

// every review route needs a signed-in user; organiser actions also need trainer/admin
router.use(authMiddleware);
const staff = requireRole('trainer');
const controller = new ReviewController();

/*
  ==================== EVENTS ====================
*/

// POST /api/review/events - Create new review event with fixed criteria & rubrics (open for testing)
router.post('/events', staff, createEventValidators, validate, controller.createEvent);

// GET /api/review/events - List all review events
router.get('/events', controller.listEvents);

// GET /api/review/events/:id - Get event details
router.get('/events/:id', eventIdValidators, validate, controller.getEvent);

// PUT /api/review/events/:id - Update event details
router.put('/events/:id', staff, updateEventValidators, validate, controller.updateEvent);

/*
  ==================== SUBMISSIONS ====================
*/

// POST /api/review/events/:id/submissions - Submit a project repository for review (open for testing)
router.post(
  '/events/:id/submissions',

  createSubmissionValidators,
  validate,
  controller.submitProject
);

// GET /api/review/events/:id/submissions - List all submissions for an event
router.get(
  '/events/:id/submissions',
  staff,
  eventIdValidators,
  validate,
  controller.listSubmissionsForEvent
);

// GET /api/review/submissions/:id - Get submission details
router.get('/submissions/:id', submissionIdValidators, validate, controller.getSubmission);

// PUT /api/review/submissions/:id - Update submission details
router.put('/submissions/:id', updateSubmissionValidators, validate, controller.updateSubmission);

// DELETE /api/review/submissions/:id - Delete a submission
router.delete(
  '/submissions/:id',
  staff,
  submissionIdValidators,
  validate,
  controller.deleteSubmission
);

/*
  ==================== EVALUATION & DURABLE WORKFLOWS ====================
*/

// POST /api/review/submissions/:id/evaluate - Dispatch durable evaluation workflow (open for testing)
router.post(
  '/submissions/:id/evaluate',
  staff,
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
  staff,
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
  staff,
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
  staff,
  submissionIdValidators,
  validate,
  controller.getEvaluationReplay
);

/*
  ==================== RANKING & PAIRWISE ====================
*/

// POST /api/review/events/:id/rank - Run Bradley-Terry relative pairwise ranking for an event (open for testing)
router.post('/events/:id/rank', staff, eventIdValidators, validate, controller.computeEventRanking);

// GET /api/review/events/:id/leaderboard - Relative ranking leaderboard
router.get(
  '/events/:id/leaderboard',
  staff,
  eventIdValidators,
  validate,
  controller.getLeaderboard
);

// GET /api/review/events/:id/pairwise - Pairwise comparison matrix & rationales
router.get(
  '/events/:id/pairwise',
  staff,
  eventIdValidators,
  validate,
  controller.getPairwiseMatrix
);

// GET /api/review/events/:id/comparison-matrix - RE:DESIGN 9-Dimension Comparison Matrix
router.get(
  '/events/:id/comparison-matrix',
  staff,
  eventIdValidators,
  validate,
  controller.getComparisonMatrix
);

// GET /api/review/submissions/:id/evidence-explorer - RE:DESIGN Evidence Explorer
router.get(
  '/submissions/:id/evidence-explorer',
  staff,
  submissionIdValidators,
  validate,
  controller.getEvidenceExplorer
);

/*
  ==================== JUDGE OVERRIDE ====================
*/

// POST /api/review/submissions/:id/override - Override score with mandatory audit reason (open for testing)
router.post(
  '/submissions/:id/override',
  staff,
  judgeOverrideValidators,
  validate,
  controller.judgeOverrideScore
);

/*
  ==================== CSV & NOTION EXPORT ====================
*/

// GET /api/review/events/:id/export/csv - Download comprehensive event CSV
router.get('/events/:id/export/csv', staff, eventIdValidators, validate, controller.exportEventCsv);

// GET /api/review/events/:id/export/notion - Export Notion markdown for event
router.get(
  '/events/:id/export/notion',
  staff,
  eventIdValidators,
  validate,
  controller.exportEventNotion
);

// POST /api/review/events/:id/export/notion/push - Push event report directly to Notion workspace
router.post(
  '/events/:id/export/notion/push',
  staff,
  eventIdValidators,
  validate,
  controller.pushEventToNotion
);

// GET /api/review/submissions/:id/export/csv - Download detailed single-submission CSV
router.get(
  '/submissions/:id/export/csv',
  staff,
  submissionIdValidators,
  validate,
  controller.exportSubmissionCsv
);

// GET /api/review/submissions/:id/export/notion - Export Notion markdown for submission
router.get(
  '/submissions/:id/export/notion',
  staff,
  submissionIdValidators,
  validate,
  controller.exportSubmissionNotion
);

// POST /api/review/submissions/:id/export/notion/push - Push submission report directly to Notion workspace
router.post(
  '/submissions/:id/export/notion/push',
  staff,
  submissionIdValidators,
  validate,
  controller.pushSubmissionToNotion
);

export default router;
