import LearnerModuleProgressDao from '../shared/dao/learnerModuleProgress.dao.js';
import ModuleDao from '../shared/dao/module.dao.js';
import CourseDao from '../shared/dao/course.dao.js';
import { IModuleDocument, IModuleReleasePolicy } from '../shared/models/module.model.js';
import { ILearnerModuleProgressDocument } from '../shared/models/learnerModuleProgress.model.js';
import logger from '../shared/config/logger.config.js';

export interface ModuleAccessEvaluation {
  isAccessible: boolean;
  reason?: string;
  unlockedAt?: Date;
  deadline?: Date;
  daysRemaining?: number;
  isExpired?: boolean;
}

export interface LearnerScheduleItem {
  moduleId: string;
  title: string;
  order: number;
  durationDays: number;
  unlockedAt: Date | null;
  deadline: Date | null;
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed' | 'expired';
  progressPercentage: number;
}

class DeadlineEngineService {
  private progressDao: LearnerModuleProgressDao;
  private moduleDao: ModuleDao;
  private courseDao: CourseDao;

  constructor() {
    this.progressDao = new LearnerModuleProgressDao();
    this.moduleDao = new ModuleDao();
    this.courseDao = new CourseDao();
  }

  /**
   * Calculates learner-specific deadline relative to their effective unlock/start date.
   * Business rule: Duration is a relative time period (e.g. 7 days), NOT a fixed calendar date.
   */
  calculateLearnerDeadline(effectiveStartDate: Date, durationDays: number): Date {
    const validDays = Math.max(1, Math.floor(durationDays || 7));
    const deadlineMs = effectiveStartDate.getTime() + validDays * 24 * 60 * 60 * 1000;
    return new Date(deadlineMs);
  }

  /**
   * Checks whether learner has reached the progression threshold (default 70%).
   */
  checkProgressionEligibility(completedPercent: number, threshold = 70): boolean {
    return completedPercent >= threshold;
  }

  /**
   * Evaluates if a module should be unlocked for a learner based on release policy and previous module status.
   */
  evaluateReleasePolicy(
    policy: IModuleReleasePolicy | undefined,
    currentDate: Date,
    allowCatchUp: boolean
  ): { isEligible: boolean; reason?: string } {
    if (!policy || policy.type === 'immediate' || policy.type === 'progression_based') {
      return { isEligible: true };
    }

    const scheduledDate = policy.releaseAt || policy.unlockAt;
    if (!scheduledDate) {
      return { isEligible: true };
    }

    const releaseTime = new Date(scheduledDate).getTime();
    const nowTime = currentDate.getTime();

    if (nowTime >= releaseTime) {
      return { isEligible: true };
    }

    // If future date, check if late joiner catch-up is allowed
    const catchUpPermitted = policy.allowLateJoinerCatchUp ?? allowCatchUp;
    if (catchUpPermitted) {
      return {
        isEligible: true,
        reason: 'Unlocked early via late-joiner catch-up policy'
      };
    }

    return {
      isEligible: false,
      reason: `Module scheduled for future release on ${new Date(releaseTime).toISOString()}`
    };
  }

  /**
   * Evaluates learner access for a specific module, computing customized deadline.
   */
  async evaluateModuleAccess(
    courseId: string,
    moduleId: string,
    userId: string,
    enrollmentDate: Date = new Date()
  ): Promise<ModuleAccessEvaluation> {
    const moduleDoc = await this.moduleDao.findModuleById(moduleId);
    if (!moduleDoc) {
      return { isAccessible: false, reason: 'Module not found' };
    }

    const course = await this.courseDao.findCourseById(courseId);
    const allowCatchUp = course?.settings?.allowLateEnrollment ?? true;

    // Check if progress already initialized for this learner & module
    let progress = await this.progressDao.findProgress(courseId, moduleId, userId);

    if (!progress) {
      // Find module order and previous module
      const allModules = await this.moduleDao.findModulesByCourseId(courseId);
      const sorted = allModules.sort((a, b) => a.order - b.order);
      const currentIndex = sorted.findIndex((m) => m._id.toString() === moduleId);

      const isFirstModule = currentIndex <= 0;

      if (isFirstModule) {
        // First module: start from learner's enrollment date
        const unlockDate = new Date(enrollmentDate);
        const deadline = this.calculateLearnerDeadline(unlockDate, moduleDoc.durationDays);

        progress = await this.progressDao.findOrCreateProgress(
          courseId,
          moduleId,
          userId,
          unlockDate,
          deadline
        );
      } else {
        // Subsequent module: check if previous module satisfied progression requirement
        const prevModule = sorted[currentIndex - 1];
        const prevProgress = await this.progressDao.findProgress(
          courseId,
          prevModule._id.toString(),
          userId
        );

        const prevThreshold = prevModule.progressRequirement || 70;
        const prevCompleted = (prevProgress?.progressPercentage || 0) >= prevThreshold;

        if (!prevCompleted) {
          return {
            isAccessible: false,
            reason: `Prerequisite module '${prevModule.title}' not completed (requires ${prevThreshold}%)`
          };
        }

        // Evaluate release policy
        const releaseEval = this.evaluateReleasePolicy(
          moduleDoc.releasePolicy,
          new Date(),
          allowCatchUp
        );
        if (!releaseEval.isEligible) {
          return {
            isAccessible: false,
            reason: releaseEval.reason
          };
        }

        // Unlock date is now (effective unlock upon meeting progression)
        const unlockDate = new Date();
        const deadline = this.calculateLearnerDeadline(unlockDate, moduleDoc.durationDays);

        progress = await this.progressDao.findOrCreateProgress(
          courseId,
          moduleId,
          userId,
          unlockDate,
          deadline
        );
      }
    }

    const now = Date.now();
    const deadlineTime = new Date(progress.deadline).getTime();
    const isExpired = now > deadlineTime;
    const daysRemaining = Math.max(0, Math.ceil((deadlineTime - now) / (1000 * 60 * 60 * 24)));

    return {
      isAccessible: true,
      unlockedAt: progress.unlockedAt,
      deadline: progress.deadline,
      daysRemaining,
      isExpired
    };
  }

  /**
   * Updates progress for a module and automatically unlocks subsequent modules if threshold reached.
   */
  async recordModuleItemCompletion(
    courseId: string,
    moduleId: string,
    userId: string,
    completedPercentage: number
  ): Promise<ILearnerModuleProgressDocument | null> {
    const moduleDoc = await this.moduleDao.findModuleById(moduleId);
    const threshold = moduleDoc?.progressRequirement || 70;

    const isCompleted = completedPercentage >= 100;
    const status = isCompleted ? 'completed' : 'in_progress';

    const updated = await this.progressDao.updateProgress(courseId, moduleId, userId, {
      progressPercentage: completedPercentage,
      status,
      completedAt: isCompleted ? new Date() : null
    });

    // If threshold reached (>= 70%), attempt to unlock next module in course
    if (completedPercentage >= threshold) {
      await this.tryUnlockNextModule(courseId, moduleId, userId);
    }

    return updated;
  }

  private async tryUnlockNextModule(
    courseId: string,
    currentModuleId: string,
    userId: string
  ): Promise<void> {
    try {
      const allModules = await this.moduleDao.findModulesByCourseId(courseId);
      const sorted = allModules.sort((a, b) => a.order - b.order);
      const currentIndex = sorted.findIndex((m) => m._id.toString() === currentModuleId);

      if (currentIndex >= 0 && currentIndex < sorted.length - 1) {
        const nextModule = sorted[currentIndex + 1];
        const nextModuleId = nextModule._id.toString();

        const existingNext = await this.progressDao.findProgress(courseId, nextModuleId, userId);
        if (!existingNext) {
          const unlockDate = new Date();
          const deadline = this.calculateLearnerDeadline(unlockDate, nextModule.durationDays);

          await this.progressDao.findOrCreateProgress(
            courseId,
            nextModuleId,
            userId,
            unlockDate,
            deadline
          );
          logger.info(
            { courseId, nextModuleId, userId, deadline },
            'Automatically unlocked next module after 70% threshold reached'
          );
        }
      }
    } catch (error) {
      logger.error(
        { err: error, courseId, currentModuleId, userId },
        'Error unlocking next module'
      );
    }
  }
}

export const deadlineEngineService = new DeadlineEngineService();
export default deadlineEngineService;
