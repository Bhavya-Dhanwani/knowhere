import express, { NextFunction, Response } from 'express';
import { body, query } from 'express-validator';
import validateErrors from '../../shared/utils/validateErrors.util.js';
import authMiddleware, { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import requireRole from '../../shared/middlewares/role.middleware.js';
import UserActivity from '../../shared/models/userActivity.model.js';
import CourseDao from '../../shared/dao/course.dao.js';
import Ok from '../../shared/responses/Ok.response.js';
import { canManageCourse, memberships } from '../../services/access.service.js';
import { coachChat, coachInsights, coachStream } from '../../services/coach.service.js';
import { streamSSE } from '../../shared/utils/sse.util.js';
import mistralGeneratorService from '../../services/mistralGenerator.service.js';

const router = express.Router();
const anyRole = [authMiddleware, requireRole('admin', 'trainer', 'trainee')];

// events the browser tracker may send; everything else is derived on the server
export const CLIENT_EVENTS = new Set([
  'SESSION_START',
  'ITEM_VIEW',
  'ITEM_DWELL',
  'VIDEO_WATCH',
  'VIDEO_SEEK',
  'VIDEO_PAUSE',
  'VIDEO_RATE',
  'VIDEO_ENDED',
  'RESOURCE_OPEN',
  'RESOURCE_DOWNLOAD',
  'CODE_RUN',
  'CODE_PASTE',
  'CODE_LANGUAGE',
  'CODE_RESET'
]);

/*
    @route POST /api/course/coach/activity
    @desc Batched behaviour events from the browser tracker (max 100 per call)
    @access Private — events are kept only for courses the caller belongs to
*/
router.post(
  '/activity',
  anyRole,
  body('events').isArray({ min: 1, max: 100 }).withMessage('events must be 1-100 items'),
  body('events.*.type').isString(),
  body('events.*.courseId').isMongoId(),
  body('events.*.itemId').optional({ values: 'null' }).isString().isLength({ max: 40 }),
  validateErrors,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const events = (req.body.events as Record<string, unknown>[]).filter(
        (e) => CLIENT_EVENTS.has(String(e.type)) && JSON.stringify(e.data ?? {}).length <= 4000
      );
      // only courses the caller is enrolled in (or teaches)
      const allowed = new Set<string>();
      for (const courseId of new Set(events.map((e) => String(e.courseId)))) {
        const member = await memberships.memberOf(courseId, userId).catch(() => null);
        const course = member ? null : await new CourseDao().findCourseById(courseId);
        if (member || (course && (await canManageCourse(req.user!, course)))) allowed.add(courseId);
      }
      const now = Date.now();
      const docs = events
        .filter((e) => allowed.has(String(e.courseId)))
        .map((e) => {
          const at = new Date(String(e.at || ''));
          return {
            userId,
            courseId: String(e.courseId),
            itemId: e.itemId ? String(e.itemId) : null,
            eventType: String(e.type),
            metadata: (e.data && typeof e.data === 'object' ? e.data : {}) as Record<
              string,
              unknown
            >,
            // client clocks drift: keep their time only when it is plausible
            timestamp: Math.abs(at.getTime() - now) < 86_400_000 ? at : new Date(now)
          };
        });
      if (docs.length) await UserActivity.insertMany(docs, { ordered: false });
      return Ok(res, 'Activity recorded', { accepted: docs.length });
    } catch (error) {
      next(error);
    }
  }
);

/*
    @route GET /api/course/coach/insights?courseId=&learnerId=
    @desc Behaviour profile (trainee: their own; staff: a learner, or the cohort roster)
*/
router.get(
  '/insights',
  anyRole,
  query('courseId').isMongoId(),
  query('learnerId').optional().isString().isLength({ max: 64 }),
  validateErrors,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await coachInsights(
        req.user!,
        String(req.query.courseId),
        req.query.learnerId ? String(req.query.learnerId) : undefined
      );
      return Ok(res, 'Insights', data);
    } catch (error) {
      next(error);
    }
  }
);

const chatValidators = [
  body('courseId').isMongoId(),
  body('learnerId').optional({ values: 'falsy' }).isString().isLength({ max: 64 }),
  body('message').isString().trim().isLength({ min: 2, max: 2000 }),
  body('history').optional().isArray({ max: 20 }),
  body('history.*.role').optional().isIn(['user', 'assistant']),
  body('history.*.content').optional().isString(),
  validateErrors
];

/*
    @route POST /api/course/coach/chat/stream
    @desc The coach's reply as Server-Sent Events (meta, token..., restart, done | error)
*/
router.post(
  '/chat/stream',
  anyRole,
  ...chatValidators,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!mistralGeneratorService.isConfigured()) {
        return res.status(503).json({
          success: false,
          status: 503,
          message: 'The AI coach is not configured on this server (MISTRAL_API_KEYS).'
        });
      }
      // access checks and retrieval happen before the stream opens, so they fail as plain JSON
      const { meta, events } = await coachStream(req.user!, {
        courseId: req.body.courseId,
        learnerId: req.body.learnerId || undefined,
        message: req.body.message,
        history: req.body.history
      });
      await streamSSE(req, res, events, meta);
    } catch (error) {
      next(error);
    }
  }
);

/*
    @route POST /api/course/coach/chat
    @desc Personalised AI coach (RAG over behaviour + course content), role-aware
*/
router.post(
  '/chat',
  anyRole,
  ...chatValidators,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!mistralGeneratorService.isConfigured()) {
        return res.status(503).json({
          success: false,
          status: 503,
          message: 'The AI coach is not configured on this server (MISTRAL_API_KEYS).'
        });
      }
      const data = await coachChat(req.user!, {
        courseId: req.body.courseId,
        learnerId: req.body.learnerId || undefined,
        message: req.body.message,
        history: req.body.history
      });
      return Ok(res, 'Answered', data);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
