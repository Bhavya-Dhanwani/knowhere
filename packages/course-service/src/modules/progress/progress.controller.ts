// Importing modules
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import CourseProgressDao from '../../shared/dao/courseProgress.dao.js';
import CourseDao from '../../shared/dao/course.dao.js';
import McqAttemptDao from '../../shared/dao/mcqAttempt.dao.js';
import CodeQuestionDao from '../../shared/dao/codeQuestion.dao.js';
import { judgeCode, JudgeResult } from '@lms/shared';
import env from '../../shared/config/env.config.js';
import { ICourseDocument } from '../../shared/models/course.model.js';
import {
  loadCourseOutline,
  outlineItems,
  outlineMaxScore
} from '../../services/courseOutline.service.js';
import { assertCanManageCourse, openCourse } from '../../services/access.service.js';
import Forbidden from '../../shared/errors/Forbidden.error.js';
import Ok from '../../shared/responses/Ok.response.js';
import NotFound from '../../shared/errors/NotFound.error.js';
import BadRequest from '../../shared/errors/BadRequest.error.js';

// a failing hidden test must not echo program output (it could smuggle out the hidden input),
// so only the kind of failure and the test number are reported
export function hiddenError(error?: string) {
  if (!error) return undefined;
  const m = error.match(/^Test (\d+): ([\s\S]*)$/);
  // compiler output only describes the learner's own code, so it is safe to show in full
  if (!m) return error.startsWith('Compilation error') ? error : error.split('\n')[0].slice(0, 200);
  return /time limit|timed out/i.test(m[2])
    ? `Time limit exceeded on test ${m[1]}`
    : `Runtime error on test ${m[1]}`;
}

const param = (v: string | string[]) => (Array.isArray(v) ? v[0] : v);
const percent = (earned: number, max: number) =>
  max > 0 ? ((earned / max) * 100).toFixed(1) : '0';

class ProgressController {
  progressDao = new CourseProgressDao();
  courseDao = new CourseDao();
  mcqAttemptDao = new McqAttemptDao();
  codeQuestionDao = new CodeQuestionDao();

  private async requireCourse(courseId: string): Promise<ICourseDocument> {
    const course = await this.courseDao.findCourseById(courseId);
    if (!course) throw new NotFound(`Course with ID '${courseId}' not found.`);
    return course;
  }

  // POST /api/courses/:courseId/content-items/:itemId/complete
  // itemId is a submodule content entry. MCQ marks are verified from recorded attempts;
  // coding marks come from judging body.code against the hidden test cases on the server.
  completeItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const courseId = param(req.params.courseId);
      const itemId = param(req.params.itemId);
      const userId = req.user!.userId;

      // enrolment + module-open rules are enforced by openCourse
      const view = await openCourse(req.user!, courseId);
      const outline = view.outline;
      const moduleIndex = outline.findIndex((m) =>
        m.submodules.some((s) => s.items.some((i) => i._id === itemId))
      );
      const item = outlineItems(outline).find((i) => i._id === itemId);
      if (!item) throw new NotFound(`Item '${itemId}' is not part of this course.`);
      if (!view.manager && new Date() < view.schedule[moduleIndex].startsAt) {
        throw new Forbidden('This module has not opened for you yet.');
      }

      let scoreEarned = 0;
      let judge: JudgeResult | undefined;
      if (item.type === 'mcq') {
        if (!(await this.mcqAttemptDao.hasCorrectAttempt(item.refId, userId))) {
          throw new BadRequest('Answer this MCQ correctly before completing it.');
        }
        scoreEarned = item.maxScore;
      } else if (item.type === 'code-question') {
        if (typeof req.body.code !== 'string' || !req.body.code.trim()) {
          throw new BadRequest('Submit your solution code to complete a coding question.');
        }
        const question = await this.codeQuestionDao.findQuestionById(item.refId);
        if (!question) throw new NotFound('Coding question not found.');
        const cases = question.testCases.length
          ? question.testCases
          : question.examples.map((e) => ({ input: e.input, expectedOutput: e.output }));
        const language = String(req.body.language || 'javascript');
        if (!question.supportedLanguages.includes(language)) {
          throw new BadRequest(`This question accepts ${question.supportedLanguages.join(', ')}.`);
        }
        const verdict = await judgeCode(language, req.body.code, cases, {
          runnerUrl: env.JUDGE_URL
        });
        // hidden tests: only the counts and the first failure leave the server
        judge = { passed: verdict.passed, total: verdict.total, error: hiddenError(verdict.error) };
        scoreEarned = judge.total ? Math.round((judge.passed / judge.total) * item.maxScore) : 0;
        // nothing passed: report the verdict without marking the item complete
        if (!judge.passed) {
          return Ok(res, 'No test cases passed', {
            itemId,
            type: item.type,
            scoreAwarded: 0,
            itemMaxScore: item.maxScore,
            judge
          });
        }
      }

      const progress = await this.progressDao.recordCompletion({
        courseId,
        userId,
        contentItemId: itemId,
        type: item.type,
        scoreEarned,
        maxScore: item.maxScore
      });
      const courseMaxScore = outlineMaxScore(outline);

      return Ok(res, 'Item completed', {
        itemId,
        type: item.type,
        scoreAwarded: scoreEarned,
        itemMaxScore: item.maxScore,
        ...(judge ? { judge } : {}),
        totalScoreEarned: progress.totalScoreEarned,
        courseMaxScore,
        percentage: percent(progress.totalScoreEarned, courseMaxScore)
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/courses/:courseId/my-progress
  getMyProgress = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const courseId = param(req.params.courseId);
      const course = await this.requireCourse(courseId);
      const progress = await this.progressDao.findProgress(courseId, req.user!.userId);
      const courseMaxScore = outlineMaxScore(await loadCourseOutline(course));
      const totalEarned = progress?.totalScoreEarned || 0;
      const completedItems = progress?.completedItems || [];

      return Ok(res, 'Course progress fetched successfully', {
        courseId,
        userId: req.user!.userId,
        totalScoreEarned: totalEarned,
        courseMaxScore,
        percentage: percent(totalEarned, courseMaxScore),
        completedItemsCount: completedItems.length,
        completedItems
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/courses/:courseId/grades (Trainer / Admin only)
  getCourseGrades = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const courseId = param(req.params.courseId);
      const course = await this.requireCourse(courseId);
      await assertCanManageCourse(req.user!, course);
      const grades = await this.progressDao.listGradesByCourse(courseId);
      const courseMaxScore = outlineMaxScore(await loadCourseOutline(course));

      return Ok(res, 'Course grades fetched successfully', {
        courseId,
        courseTitle: course.title,
        courseMaxScore,
        totalStudents: grades.length,
        grades: grades.map((g) => ({
          userId: g.userId,
          totalScoreEarned: g.totalScoreEarned,
          percentage: percent(g.totalScoreEarned, courseMaxScore),
          completedCount: g.completedItems.length
        }))
      });
    } catch (error) {
      next(error);
    }
  };
}

export default ProgressController;
