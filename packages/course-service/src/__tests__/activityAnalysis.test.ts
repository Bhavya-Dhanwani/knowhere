import { jest } from '@jest/globals';
import activityAnalysisService from '../services/activityAnalysis.service.js';
import UserActivityDao from '../shared/dao/userActivity.dao.js';
import ModuleDao from '../shared/dao/module.dao.js';
import LearnerModuleProgressDao from '../shared/dao/learnerModuleProgress.dao.js';
import McqAttemptDao from '../shared/dao/mcqAttempt.dao.js';
import { IUserActivityDocument } from '../shared/models/userActivity.model.js';
import { IModuleDocument } from '../shared/models/module.model.js';
import { ILearnerModuleProgressDocument } from '../shared/models/learnerModuleProgress.model.js';
import { IMcqAttemptDocument } from '../shared/models/mcqAttempt.model.js';

describe('Activity Analysis Engine Unit Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('aggregates active days, learning time, and MCQ accuracy correctly', async () => {
    const mockActivities = [
      {
        timestamp: new Date('2026-08-01T10:00:00Z'),
        eventType: 'VIDEO_WATCH_DURATION',
        metadata: { seconds: 1200 }
      },
      {
        timestamp: new Date('2026-08-01T15:00:00Z'),
        eventType: 'MCQ_ATTEMPTED',
        metadata: {}
      },
      {
        timestamp: new Date('2026-08-02T11:00:00Z'),
        eventType: 'VIDEO_WATCH_DURATION',
        metadata: { seconds: 2400 }
      }
    ] as unknown as IUserActivityDocument[];

    jest
      .spyOn(UserActivityDao.prototype, 'getActivitiesForUserAndCourse')
      .mockResolvedValue(mockActivities);

    jest
      .spyOn(ModuleDao.prototype, 'findModulesByCourseId')
      .mockResolvedValue([{ _id: 'mod-1' }, { _id: 'mod-2' }] as unknown as IModuleDocument[]);

    jest.spyOn(LearnerModuleProgressDao.prototype, 'listModuleProgressesByUser').mockResolvedValue([
      { moduleId: 'mod-1', status: 'completed', progressPercentage: 100 },
      { moduleId: 'mod-2', status: 'in_progress', progressPercentage: 50 }
    ] as unknown as ILearnerModuleProgressDocument[]);

    jest
      .spyOn(McqAttemptDao.prototype, 'listAttemptsByUser')
      .mockResolvedValue([
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: false }
      ] as unknown as IMcqAttemptDocument[]);

    const result = await activityAnalysisService.analyzeUserActivity(
      'user-1',
      '507f1f77bcf86cd799439011',
      new Date('2026-08-01T00:00:00Z'),
      new Date('2026-08-05T00:00:00Z')
    );

    expect(result.userId).toBe('user-1');
    expect(result.summary.activeDays).toBe(2); // Aug 1 and Aug 2
    expect(result.summary.completedModules).toBe(1);
    expect(result.summary.totalModules).toBe(2);
    expect(result.summary.courseProgress).toBe(75); // (100 + 50) / 2
    expect(result.summary.mcqAccuracy).toBe(75); // 3 of 4
    expect(result.insights.length).toBeGreaterThan(0);
  });
});
