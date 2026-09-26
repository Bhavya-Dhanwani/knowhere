// Learner-specific module deadlines.
//
// A module's deadline is a relative period (durationDays), never a fixed date:
//  - first module starts at max(its release, the learner's join date)
//  - a learner who reached the previous module's threshold (default 70%) on or before
//    this module's release has caught up and follows the cohort: start = release
//  - otherwise the module waits for the learner's previous deadline:
//    start = max(release, previous deadline)
// Example: launch Aug 1, M1 (7d) released Aug 1, learner joins Aug 7 -> M1 ends Aug 14.
// M2 released Aug 8 -> for this learner it starts Aug 14. Finish M2 (>=70%) before M3's
// release -> M3 runs on the cohort's dates again.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ScheduleModuleInput {
  moduleId: string;
  releaseAt: Date;
  durationDays: number;
  itemIds: string[];
  threshold?: number;
}

export interface ScheduledModule {
  moduleId: string;
  releaseAt: Date;
  startsAt: Date;
  deadline: Date;
  released: boolean;
  completedPercent: number;
  // when the learner crossed the threshold for this module (null = not yet)
  thresholdReachedAt: Date | null;
}

const maxDate = (a: Date, b: Date) => (a.getTime() >= b.getTime() ? a : b);

export function computeSchedule(
  modules: ScheduleModuleInput[],
  joinedAt: Date,
  completedAt: Map<string, Date>,
  now: Date = new Date()
): ScheduledModule[] {
  const out: ScheduledModule[] = [];

  for (const m of modules) {
    const prev = out[out.length - 1];
    let startsAt: Date;
    if (!prev) {
      startsAt = maxDate(m.releaseAt, joinedAt);
    } else if (prev.thresholdReachedAt && prev.thresholdReachedAt <= m.releaseAt) {
      startsAt = m.releaseAt;
    } else {
      startsAt = maxDate(m.releaseAt, prev.deadline);
    }

    const threshold = m.threshold ?? 70;
    const times = m.itemIds
      .map((id) => completedAt.get(id))
      .filter((d): d is Date => Boolean(d))
      .sort((a, b) => a.getTime() - b.getTime());
    const needed = Math.ceil((threshold / 100) * m.itemIds.length);
    // an empty module has nothing to complete, so it counts as done once it starts
    const thresholdReachedAt =
      m.itemIds.length === 0 ? startsAt : times.length >= needed ? times[needed - 1] : null;

    out.push({
      moduleId: m.moduleId,
      releaseAt: m.releaseAt,
      startsAt,
      deadline: new Date(startsAt.getTime() + Math.max(1, m.durationDays) * DAY_MS),
      released: now >= m.releaseAt,
      completedPercent: m.itemIds.length ? (times.length / m.itemIds.length) * 100 : 100,
      thresholdReachedAt
    });
  }

  return out;
}
