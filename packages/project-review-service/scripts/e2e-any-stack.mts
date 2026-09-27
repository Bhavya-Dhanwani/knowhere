// End-to-end check across stacks: a C (make), a Python (pytest) and an HTML repo are submitted with
// blank branches, built + tested in the judge sandbox, graded and ranked. Needs the service running
// with JUDGE_URL pointing at a judge-runner:
//   REVIEW_URL=http://localhost:5016/api/review node --import tsx scripts/e2e-any-stack.mts
import { signAccessToken } from '@lms/shared';
const BASE = process.env.REVIEW_URL || 'http://localhost:5016/api/review';
const tok = (userId: string, role: string) => signAccessToken({ userId, role, name: userId }, '2h');
const trainer = tok('e2e-trainer', 'trainer');
const call = async (method: string, path: string, token: string, body?: unknown) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
};

const ev = await call('POST', '/events', trainer, {
  name: 'E2E: Any-stack code challenge',
  description: 'Small programs in any language',
  problemStatement: 'Build a small, working program in any language. It must compile/run, and tests are a plus.',
  judgingPrompt:
    'Correctness first: it must build and its tests must pass. Then readable, idiomatic code for its language. Do not penalise missing UI.',
  projectType: 'CUSTOM',
  requiresLiveUrl: false,
  requiresApiSpec: false,
  criteria: [
    { id: 'works', name: 'Correctness', category: 'REQUIREMENTS', weight: 0.5, description: 'Builds cleanly and its tests pass' },
    { id: 'quality', name: 'Code quality', category: 'CODE_QUALITY', weight: 0.5, description: 'Readable, idiomatic, safe code for its language' }
  ],
  requirements: [{ id: 'r-run', title: 'Runs', description: 'The program builds and runs', mandatory: true }]
});
console.log('event', ev.status, ev.json.message);
const eventId = ev.json.data._id;
const subs = [
  ['C kilo', 'https://github.com/antirez/kilo'],
  ['Python learn-python', 'https://github.com/trekhleb/learn-python'],
  ['HTML MDN', 'https://github.com/mdn/beginner-html-site-styled'],
  // real Node library: npm dependencies (via the registry proxy) + a mocha test suite
  ['Node cors', 'https://github.com/expressjs/cors'],
  // same repo as the C student: must show up as possible copying
  ['Copycat', 'https://github.com/antirez/kilo.git']
];
for (let i = 0; i < subs.length; i++) {
  const r = await call('POST', `/events/${eventId}/submissions`, tok(`stu-${i}`, 'trainee'), {
    teamName: subs[i][0], teamId: `t${i}`, repositoryUrl: subs[i][1], branch: ''
  });
  console.log('submit', subs[i][0], r.status, r.json.data?.commitHash?.slice(0, 7) ?? r.json.message);
}
const t0 = Date.now();
console.log('run', (await call('POST', `/events/${eventId}/evaluate-all`, trainer)).json.message);
let list: any[] = [];
for (;;) {
  await new Promise((r) => setTimeout(r, 5000));
  list = (await call('GET', `/events/${eventId}/submissions`, trainer)).json.data;
  if (list.every((x) => ['EVALUATED', 'FAILED', 'FLAGGED_FOR_REVIEW'].includes(x.status))) break;
}
for (let i = 0; i < 40; i++) {
  const lb = (await call('GET', `/events/${eventId}/leaderboard`, trainer)).json.data;
  if (lb && new Date(lb.generatedAt).getTime() > t0) break;
  await new Promise((r) => setTimeout(r, 5000));
}
console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s`);
const ranking = (await call('GET', `/events/${eventId}/leaderboard`, trainer)).json.data;
console.log('copy flags:', JSON.stringify((ranking?.similarityFlags || []).map((f: any) => [f.subAName, f.subBName, f.similarity, f.reason])));
for (const s of list) {
  const rep = (await call('GET', `/submissions/${s._id}/report`, trainer)).json.data;
  const b = rep.evidence?.buildEval;
  console.log(`\n### ${s.teamName} [${s.status}] score ${rep.evaluation?.overallScore} rank ${rep.ranking?.rank ?? '-'}`);
  console.log(`  build: ${b?.status} ${b?.reason ?? ''}`);
  for (const st of b?.steps || [])
    console.log(`   - ${st.name}: ${st.ok === null ? 'NOT RUN ' + st.skipped : st.ok ? 'passed' : 'FAILED ' + (st.error || '')}${st.tests ? ` (${st.tests.passed} passed, ${st.tests.failed} failed)` : ''} ${st.timeMs ?? ''}ms${st.note ? ' | ' + st.note : ''}`);
  const dm = rep.evidence?.codeAnalysis?.deterministicMetrics;
  console.log(`  metrics: typed=${dm?.typeSafety?.staticTyping} tests=${dm?.testMetrics?.testCaseCount} [${dm?.testMetrics?.testFrameworks}] avgCx=${dm?.cyclomaticComplexity?.averagePerFunction} unsafe=${(rep.evidence?.codeAnalysis?.semgrep?.findings || []).filter((f: any) => !/secret/.test(f.ruleId)).map((f: any) => `${f.ruleId}@${f.path}:${f.line}`).slice(0, 4).join(', ')}`);
  for (const c of rep.evaluation?.criterionScores || []) console.log(`  [${c.rawScore}] ${c.name}: ${c.justification.slice(0, 330)}`);
}
process.exit(0);
