// End-to-end check of the review pipeline over HTTP: event, custom form, submissions, access
// control, parallel run, rubric grades and ranking. Run it against a service on a *_dev database:
//   REVIEW_URL=http://localhost:5016/api/review node --import tsx scripts/e2e.mts
import { signAccessToken } from '@lms/shared';

const BASE = process.env.REVIEW_URL || 'http://localhost:5016/api/review';
const tok = (userId: string, role: string, name: string) =>
  signAccessToken({ userId, role, name, email: `${userId}@test.dev` }, '2h');
const trainer = tok('e2e-trainer', 'trainer', 'Trainer');
const students = ['stu-a', 'stu-b', 'stu-c', 'stu-d'].map((id) => tok(id, 'trainee', id));

const call = async (method: string, path: string, token: string, body?: unknown) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, json };
};
const check = (label: string, ok: boolean, extra = '') =>
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);

// ---------- 1. trainer creates the event ----------
const ev = await call('POST', '/events', trainer, {
  name: 'E2E: Personal page (HTML/CSS)',
  description: 'Beginner HTML/CSS personal page',
  problemStatement:
    'Build a personal/profile web page with HTML and CSS that introduces a topic or person. Judged mostly on how the page looks and on clean, semantic HTML/CSS.',
  projectType: 'FRONTEND',
  requiresLiveUrl: true,
  requiresApiSpec: false,
  criteria: [
    { id: 'look', name: 'Look of the site', category: 'FRONTEND', weight: 0.4, description: 'Visual design: layout, typography, colour, spacing, polish, works on mobile' },
    { id: 'semantic', name: 'Semantic HTML & naming', category: 'CODE_QUALITY', weight: 0.3, description: 'Semantic elements, meaningful class/id names, valid structure, alt text' },
    { id: 'css', name: 'CSS quality', category: 'CODE_QUALITY', weight: 0.3, description: 'Organised, reusable CSS; no inline styles; sensible units and selectors' }
  ],
  requirements: [
    { id: 'r-img', title: 'At least one image with alt text', description: 'An <img> with a meaningful alt attribute', mandatory: true },
    { id: 'r-css', title: 'External stylesheet', description: 'Styles live in a linked .css file', mandatory: true },
    { id: 'r-list', title: 'A list of items', description: 'Uses <ul> or <ol>', mandatory: false }
  ],
  formFields: [
    { id: 'about', label: 'What did you focus on?', type: 'textarea', required: true },
    { id: 'track', label: 'Level', type: 'select', required: false, options: ['Beginner', 'Intermediate'] }
  ],
  submissionDeadline: new Date(Date.now() + 86400000).toISOString()
});
check('trainer creates event', ev.status === 201, ev.json.message);
const eventId = ev.json.data?._id;
const st = await call('POST', '/events', students[0], { name: 'x' });
check('student cannot create event', st.status === 403, String(st.status));

// ---------- 2. submissions: validation ----------
const base = { teamId: 't', branch: 'main', formResponses: { about: 'Layout and typography', track: 'Beginner' } };
const bad1 = await call('POST', `/events/${eventId}/submissions`, students[0], { ...base, teamName: 'X', repositoryUrl: 'https://github.com/mdn' });
check('profile link rejected at submit', bad1.status === 400, bad1.json.message);
const bad2 = await call('POST', `/events/${eventId}/submissions`, students[0], { ...base, teamName: 'X', repositoryUrl: 'https://github.com/mdn/beginner-html-site', formResponses: {} });
check('missing required form answer rejected', bad2.status === 400, bad2.json.message);
const bad3 = await call('POST', `/events/${eventId}/submissions`, students[0], { ...base, teamName: 'X', repositoryUrl: 'https://github.com/mdn/beginner-html-site', branch: 'no-such-branch' });
check('wrong branch rejected at submit', bad3.status === 400, bad3.json.message);

// ---------- 3. real submissions ----------
const subs = [
  ['Unstyled MDN', 'https://github.com/mdn/beginner-html-site', 'https://mdn.github.io/beginner-html-site/'],
  ['Styled MDN', 'https://github.com/mdn/beginner-html-site-styled.git', 'https://mdn.github.io/beginner-html-site-styled/'],
  ['Scripted MDN', 'https://github.com/mdn/beginner-html-site-scripted/tree/main', 'https://mdn.github.io/beginner-html-site-scripted/'],
  ['Spoon Knife', 'https://octocat.github.io/Spoon-Knife/', 'https://octocat.github.io/Spoon-Knife/']
];
const ids: string[] = [];
for (let i = 0; i < subs.length; i++) {
  const [teamName, repositoryUrl, liveSiteUrl] = subs[i];
  const r = await call('POST', `/events/${eventId}/submissions`, students[i], { ...base, teamName, repositoryUrl, liveSiteUrl });
  check(`submit ${teamName}`, r.status === 201, `commit ${r.json.data?.commitHash?.slice(0, 7) ?? r.json.message}`);
  ids.push(r.json.data?._id);
}
const again = await call('POST', `/events/${eventId}/submissions`, students[0], { ...base, teamName: 'Unstyled MDN', repositoryUrl: subs[0][1], liveSiteUrl: subs[0][2] });
check('resubmission replaces, not duplicates', again.status === 200 && again.json.data?._id === ids[0], again.json.message);

// ---------- 4. access control ----------
check('student reads own submission', (await call('GET', `/submissions/${ids[0]}`, students[0])).status === 200);
check('student cannot read another team', (await call('GET', `/submissions/${ids[0]}`, students[1])).status === 403);
check('student cannot edit another team', (await call('PUT', `/submissions/${ids[0]}`, students[1], { teamName: 'hacked' })).status === 403);
check('student cannot read another report', (await call('GET', `/submissions/${ids[0]}/report`, students[1])).status === 403);
check('student cannot list submissions', (await call('GET', `/events/${eventId}/submissions`, students[1])).status === 403);
check('student cannot start evaluation', (await call('POST', `/events/${eventId}/evaluate-all`, students[1])).status === 403);

// ---------- 5. parallel evaluation ----------
const t0 = Date.now();
const run = await call('POST', `/events/${eventId}/evaluate-all`, trainer);
check('trainer starts parallel run', run.status === 202, run.json.message);
const dup = await call('POST', `/events/${eventId}/evaluate-all`, trainer);
check('second run while busy is refused', dup.status === 409, dup.json.message);
const edit = await call('PUT', `/submissions/${ids[1]}`, students[1], { teamName: 'x' });
check('student cannot edit while queued', edit.status === 409, edit.json.message);

let list: any[] = [];
for (;;) {
  await new Promise((r) => setTimeout(r, 5000));
  list = (await call('GET', `/events/${eventId}/submissions`, trainer)).json.data;
  const s = list.map((x) => x.status[0]).join('');
  process.stdout.write(`\r${Math.round((Date.now() - t0) / 1000)}s statuses ${s}   `);
  if (list.every((x) => ['EVALUATED', 'FAILED', 'FLAGGED_FOR_REVIEW'].includes(x.status))) break;
}
console.log();
let lb: any = null;
for (let i = 0; i < 60; i++) {
  lb = (await call('GET', `/events/${eventId}/leaderboard`, trainer)).json.data;
  if (lb && new Date(lb.generatedAt).getTime() > t0) break;
  await new Promise((r) => setTimeout(r, 5000));
}
console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s; statuses:`, list.map((x) => `${x.teamName}=${x.status}`).join(', '));

// ---------- 6. results ----------
for (const e of lb.leaderboard) {
  const rep = (await call('GET', `/submissions/${e.submissionId}/report`, trainer)).json.data;
  const ev = rep.evaluation;
  console.log(`\n#${e.rank} ${e.teamName}  score ${e.absoluteScore}  (prompts ${ev?.reproducibility?.promptsVersion})`);
  for (const c of ev?.criterionScores || []) console.log(`   [${c.rawScore}] ${c.name}: ${c.justification}`);
  for (const r of ev?.requirementCompliance || []) console.log(`   req ${r.status}: ${r.title} - ${r.evidenceSummary}`);
  const fe = rep.evidence?.frontendEval;
  console.log(`   live: ${fe?.assessmentMode} lh=${JSON.stringify(fe?.lighthouse)} shots=${!!fe?.screenshots?.desktop}/${!!fe?.screenshots?.mobile}`);
  console.log(`   findings: ${(fe?.findings || []).join(' | ')}`);
  if (e.headToHead) {
    const h = e.headToHead;
    console.log(`   H2H vs ${h.vsTeam}: winner ${h.winnerTeam} agrees=${h.agreesWithRanking} consistent=${h.positionConsistent}`);
    console.log(`      ${h.verdict}`);
    for (const f of h.decisiveFactors) console.log(`      - ${f.area} [${f.impact}]: W ${f.winnerDid} || L ${f.loserDid}`);
    console.log(`      loser better: ${h.whereLoserWasBetter.join(' | ')}`);
    console.log(`      to overtake: ${h.loserToOvertake.join(' | ')}`);
  }
}
const own = await call('GET', `/submissions/${ids[0]}/report`, students[0]);
check('\nstudent reads own report', own.status === 200);
process.exit(0);
