// What students can and cannot see, over HTTP (no evaluation, no LLM calls). Run against a service
// on a *_dev database:  REVIEW_URL=http://localhost:5016/api/review node --import tsx scripts/e2e-student-view.mts
import assert from 'node:assert/strict';
import { signAccessToken } from '@lms/shared';

const BASE = process.env.REVIEW_URL || 'http://localhost:5016/api/review';
const tok = (userId: string, role: string) => signAccessToken({ userId, role, name: userId }, '1h');
const trainer = tok('sv-trainer', 'trainer');
const student = tok(`sv-student-${Date.now()}`, 'trainee');
const call = async (method: string, path: string, token: string, body?: unknown) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
};

const ev = await call('POST', '/events', trainer, {
  name: 'Student view check',
  description: 'x',
  problemStatement: 'Print the sum of two numbers.',
  judgingPrompt: 'Secret: we mostly care about edge cases.',
  judgingPromptPublic: false,
  ioTests: [{ name: 'hidden', input: '2 3', expected: '5' }],
  projectType: 'CUSTOM',
  criteria: [{ id: 'c', name: 'Correctness', category: 'REQUIREMENTS', weight: 1, description: 'Works' }]
});
assert.equal(ev.status, 201, JSON.stringify(ev.json));
const eventId = ev.json.data._id;

const seen = (await call('GET', `/events/${eventId}`, student)).json.data;
assert.equal(seen.judgingPrompt, undefined, 'private judging instructions hidden from students');
assert.equal(seen.ioTests, undefined, 'hidden test cases (the answers) never sent to students');
assert.equal((await call('GET', `/events/${eventId}`, trainer)).json.data.ioTests.length, 1, 'trainer sees them');

const sub = await call('POST', `/events/${eventId}/submissions`, student, {
  teamName: 'Solo',
  teamId: 's1',
  repositoryUrl: 'https://github.com/mdn/beginner-html-site'
});
assert.equal(sub.status, 201, JSON.stringify(sub.json));
const subId = sub.json.data._id;

const mine = (await call('GET', '/my-submissions', student)).json.data;
assert.equal(mine.length, 1, 'student sees exactly their own submission');
assert.equal(mine[0].event.name, 'Student view check');
assert.equal(mine[0].result, null, 'no score before results are published');
assert.equal((await call('GET', '/my-submissions', trainer)).json.data.some((s: any) => s._id === subId), false, "others' submissions never listed");

const before = (await call('GET', `/submissions/${subId}/report`, student)).json.data;
assert.equal(before.published, false, 'report is status-only before publishing');
assert.equal(before.evaluation, undefined);

assert.equal((await call('PUT', `/events/${eventId}`, student, { resultsPublished: true })).status, 403, 'students cannot publish');
assert.equal((await call('PUT', `/events/${eventId}`, trainer, { resultsPublished: true })).status, 200);

const after = (await call('GET', `/submissions/${subId}/report`, student)).json.data;
assert.equal(after.published, true, 'full report once published');
assert.equal(after.sanitizationAudit, undefined, 'injection-defence internals stay with organisers');
assert.notEqual((await call('GET', `/submissions/${subId}/report`, trainer)).json.data.published, false);

console.log('student view: all checks passed');
process.exit(0);
