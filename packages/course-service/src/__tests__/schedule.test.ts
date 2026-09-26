import { computeSchedule } from '../services/schedule.service.js';

const d = (s: string) => new Date(`2026-08-${s}T00:00:00Z`);
const day = (x: Date) => x.toISOString().slice(0, 10);

describe('computeSchedule (learner module deadlines)', () => {
  const modules = [
    { moduleId: 'm1', releaseAt: d('01'), durationDays: 7, itemIds: ['a', 'b'] },
    { moduleId: 'm2', releaseAt: d('08'), durationDays: 7, itemIds: ['c', 'd', 'e'] },
    { moduleId: 'm3', releaseAt: d('22'), durationDays: 7, itemIds: ['f'] }
  ];

  it('on-time learner follows the cohort dates', () => {
    const s = computeSchedule(modules, d('01'), new Map(), d('02'));
    expect(s.map((m) => day(m.deadline))).toEqual(['2026-08-08', '2026-08-15', '2026-08-29']);
  });

  it('late joiner: first deadline from join date, next module waits for it', () => {
    const s = computeSchedule(modules, d('07'), new Map(), d('07'));
    expect(day(s[0].deadline)).toBe('2026-08-14');
    expect(day(s[1].startsAt)).toBe('2026-08-14');
    expect(day(s[1].deadline)).toBe('2026-08-21');
  });

  it('late joiner who reaches 70% before the next release rejoins the cohort schedule', () => {
    const done = new Map([
      ['a', d('09')],
      ['b', d('10')],
      ['c', d('15')],
      ['d', d('18')] // 2/3 = 67% < 70%
    ]);
    const behind = computeSchedule(modules, d('07'), done, d('19'));
    expect(behind[1].thresholdReachedAt).toBeNull();

    done.set('e', d('20')); // 3/3 before M3 releases on the 22nd
    const caughtUp = computeSchedule(modules, d('07'), done, d('20'));
    expect(day(caughtUp[2].startsAt)).toBe('2026-08-22');
    expect(day(caughtUp[2].deadline)).toBe('2026-08-29');
  });

  it('still behind when M3 releases: M3 starts from the learner M2 deadline', () => {
    const early = [{ ...modules[2], releaseAt: d('16') }];
    const s = computeSchedule([modules[0], modules[1], ...early], d('07'), new Map(), d('16'));
    expect(day(s[2].startsAt)).toBe('2026-08-21');
  });
});
