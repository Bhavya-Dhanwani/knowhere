import UserActivityDao from '../shared/dao/userActivity.dao.js';
import ModuleDao from '../shared/dao/module.dao.js';
import CourseDao from '../shared/dao/course.dao.js';
import LearnerModuleProgressDao from '../shared/dao/learnerModuleProgress.dao.js';
import McqAttemptDao from '../shared/dao/mcqAttempt.dao.js';
import { UserActivityEventType } from '../shared/models/userActivity.model.js';
import logger from '../shared/config/logger.config.js';

export interface AnalysisInsight {
  type: 'PROGRESS' | 'ENGAGEMENT' | 'PERFORMANCE' | 'BEHAVIOR';
  message: string;
  severity: 'INFO' | 'WARNING' | 'ALERT';
}

export interface ActivityAnalysisSummary {
  courseProgress: number;
  activeDays: number;
  learningTimeMinutes: number;
  mcqAccuracy: number;
  completedModules: number;
  totalModules: number;
}

export interface ActivityAnalysisResult {
  userId: string;
  courseId: string;
  period: {
    from: string;
    to: string;
  };
  summary: ActivityAnalysisSummary;
  insights: AnalysisInsight[];
}

class ActivityAnalysisService {
  private activityDao: UserActivityDao;
  private moduleDao: ModuleDao;
  private courseDao: CourseDao;
  private progressDao: LearnerModuleProgressDao;
  private mcqAttemptDao: McqAttemptDao;

  constructor() {
    this.activityDao = new UserActivityDao();
    this.moduleDao = new ModuleDao();
    this.courseDao = new CourseDao();
    this.progressDao = new LearnerModuleProgressDao();
    this.mcqAttemptDao = new McqAttemptDao();
  }

  async logEvent(
    userId: string,
    courseId: string,
    eventType: UserActivityEventType,
    metadata: Record<string, unknown> = {},
    moduleId?: string,
    submoduleId?: string
  ): Promise<void> {
    try {
      await this.activityDao.logActivity({
        userId,
        courseId: courseId as unknown as import('mongoose').Types.ObjectId,
        moduleId: moduleId ? (moduleId as unknown as import('mongoose').Types.ObjectId) : null,
        submoduleId: submoduleId
          ? (submoduleId as unknown as import('mongoose').Types.ObjectId)
          : null,
        eventType,
        metadata,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error(
        { err: error, userId, courseId, eventType },
        'Failed to record user activity log'
      );
    }
  }

  async analyzeUserActivity(
    userId: string,
    courseId: string,
    from?: Date,
    to?: Date
  ): Promise<ActivityAnalysisResult> {
    const startDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = to || new Date();

    const activities = await this.activityDao.getActivitiesForUserAndCourse(
      userId,
      courseId,
      startDate,
      endDate
    );

    // 1. Calculate active days
    const activeDateStrings = new Set<string>();
    let learningSeconds = 0;

    for (const act of activities) {
      const dateStr = act.timestamp.toISOString().split('T')[0];
      activeDateStrings.add(dateStr);

      if (act.eventType === 'VIDEO_WATCH_DURATION' && typeof act.metadata?.seconds === 'number') {
        learningSeconds += act.metadata.seconds;
      } else {
        // approximate 3 minutes per active non-watch interaction
        learningSeconds += 180;
      }
    }

    const activeDays = activeDateStrings.size;
    const learningTimeMinutes = Math.round(learningSeconds / 60);

    // 2. Fetch module and course progress
    const allModules = await this.moduleDao.findModulesByCourseId(courseId);
    const totalModules = allModules.length;

    const moduleProgresses = await this.progressDao.listModuleProgressesByUser(courseId, userId);
    let completedModules = 0;
    let sumPercentage = 0;

    for (const p of moduleProgresses) {
      if (p.status === 'completed' || p.progressPercentage >= 100) {
        completedModules++;
      }
      sumPercentage += p.progressPercentage || 0;
    }

    const courseProgress = totalModules > 0 ? Math.round(sumPercentage / totalModules) : 0;

    // 3. Calculate MCQ accuracy
    const attempts = await this.mcqAttemptDao.listAttemptsByUser(userId, courseId);
    let correctCount = 0;
    for (const a of attempts) {
      if (a.isCorrect) correctCount++;
    }

    const mcqAccuracy =
      attempts.length > 0 ? Math.round((correctCount / attempts.length) * 100) : 0;

    // 4. Generate deterministic insights
    const insights: AnalysisInsight[] = [];

    insights.push({
      type: 'PROGRESS',
      message: `The learner completed ${completedModules} of ${totalModules} modules with ${courseProgress}% overall course progress.`,
      severity: 'INFO'
    });

    if (activeDays >= 7) {
      insights.push({
        type: 'ENGAGEMENT',
        message: `High engagement: active on ${activeDays} separate days in the analyzed window.`,
        severity: 'INFO'
      });
    } else if (activeDays < 3 && totalModules > 0) {
      insights.push({
        type: 'ENGAGEMENT',
        message: `Low learning activity detected (${activeDays} active days). Consider setting study reminders.`,
        severity: 'WARNING'
      });
    }

    if (attempts.length >= 5) {
      if (mcqAccuracy >= 80) {
        insights.push({
          type: 'PERFORMANCE',
          message: `Strong concept mastery: ${mcqAccuracy}% MCQ accuracy across ${attempts.length} attempts.`,
          severity: 'INFO'
        });
      } else if (mcqAccuracy < 50) {
        insights.push({
          type: 'PERFORMANCE',
          message: `MCQ accuracy is currently ${mcqAccuracy}%. Revisiting core lecture materials is recommended.`,
          severity: 'WARNING'
        });
      }
    }

    return {
      userId,
      courseId,
      period: {
        from: startDate.toISOString(),
        to: endDate.toISOString()
      },
      summary: {
        courseProgress,
        activeDays,
        learningTimeMinutes,
        mcqAccuracy,
        completedModules,
        totalModules
      },
      insights
    };
  }
}

export const activityAnalysisService = new ActivityAnalysisService();
export default activityAnalysisService;
