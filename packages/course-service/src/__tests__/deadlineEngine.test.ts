import { jest } from '@jest/globals';
import deadlineEngineService from '../services/deadlineEngine.service.js';
import ModuleDao from '../shared/dao/module.dao.js';
import CourseDao from '../shared/dao/course.dao.js';
import LearnerModuleProgressDao from '../shared/dao/learnerModuleProgress.dao.js';

describe('Course Progress & Relative Deadline Engine Unit Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('calculateLearnerDeadline', () => {
    it('calculates deadline relative to learner start date (not fixed calendar date)', () => {
      // Course launched Aug 1
      // Learner enrolls Aug 7
      const learnerStartDate = new Date('2026-08-07T10:00:00.000Z');
      const durationDays = 7;

      const deadline = deadlineEngineService.calculateLearnerDeadline(
        learnerStartDate,
        durationDays
      );

      // Expected deadline: Aug 14 at exact same time
      expect(deadline.toISOString()).toBe('2026-08-14T10:00:00.000Z');
      expect(deadline.getTime() - learnerStartDate.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('ensures late-joiner receives full window and not an expired deadline', () => {
      const courseLaunchDate = new Date('2026-08-01T00:00:00.000Z');
      const lateEnrollmentDate = new Date('2026-08-20T14:30:00.000Z');
      const durationDays = 14;

      const deadline = deadlineEngineService.calculateLearnerDeadline(
        lateEnrollmentDate,
        durationDays
      );

      expect(deadline.getTime()).toBeGreaterThan(lateEnrollmentDate.getTime());
      expect(deadline.toISOString()).toBe('2026-09-03T14:30:00.000Z');
      expect(deadline.getTime()).toBeGreaterThan(courseLaunchDate.getTime());
    });

    it('handles short durations correctly (e.g. 3 days)', () => {
      const start = new Date('2026-09-01T00:00:00.000Z');
      const deadline = deadlineEngineService.calculateLearnerDeadline(start, 3);
      expect(deadline.toISOString()).toBe('2026-09-04T00:00:00.000Z');
    });
  });

  describe('checkProgressionEligibility (70% threshold)', () => {
    it('returns true when progress is exactly 70%', () => {
      expect(deadlineEngineService.checkProgressionEligibility(70, 70)).toBe(true);
    });

    it('returns true when progress exceeds 70%', () => {
      expect(deadlineEngineService.checkProgressionEligibility(85, 70)).toBe(true);
    });

    it('returns false when progress is below 70%', () => {
      expect(deadlineEngineService.checkProgressionEligibility(69.9, 70)).toBe(false);
      expect(deadlineEngineService.checkProgressionEligibility(40, 70)).toBe(false);
    });
  });

  describe('evaluateReleasePolicy', () => {
    it('immediately unlocks when policy type is immediate', () => {
      const res = deadlineEngineService.evaluateReleasePolicy(
        { type: 'immediate' },
        new Date('2026-08-01T00:00:00.000Z'),
        false
      );
      expect(res.isEligible).toBe(true);
    });

    it('respects future scheduled release when catch-up is disabled', () => {
      const scheduledRelease = new Date('2026-08-15T00:00:00.000Z');
      const currentDate = new Date('2026-08-10T00:00:00.000Z');

      const res = deadlineEngineService.evaluateReleasePolicy(
        {
          type: 'scheduled',
          releaseAt: scheduledRelease,
          allowLateJoinerCatchUp: false
        },
        currentDate,
        false
      );

      expect(res.isEligible).toBe(false);
      expect(res.reason).toContain('future release');
    });

    it('allows late-joiner catch-up before scheduled release date if policy permits', () => {
      const scheduledRelease = new Date('2026-08-15T00:00:00.000Z');
      const currentDate = new Date('2026-08-10T00:00:00.000Z');

      const res = deadlineEngineService.evaluateReleasePolicy(
        {
          type: 'scheduled',
          releaseAt: scheduledRelease,
          allowLateJoinerCatchUp: true
        },
        currentDate,
        true
      );

      expect(res.isEligible).toBe(true);
      expect(res.reason).toContain('catch-up policy');
    });
  });
});
