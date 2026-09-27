// Browser end-to-end test: drives the real UI as an admin, a trainer and a student.
//   node scripts/ui-e2e.mjs                 (app on http://localhost:3100, seeded demo data)
//   BASE=http://localhost:3000 node scripts/ui-e2e.mjs
// Uses the installed Microsoft Edge with a fake microphone (voice rooms). Screenshots of failed
// steps go to ./ui-e2e-shots. Exits non-zero if any step fails.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:3100';
const HEADED = process.env.HEADED === '1';
const RUN = Date.now().toString(36);
const SHOTS = 'ui-e2e-shots';
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({
  channel: 'msedge',
  headless: !HEADED,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
});

let failures = 0;
const problems = [];

async function session(label, email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on('console', (m) => m.type() === 'error' && !/favicon|WebSocket|DevTools/.test(m.text()) && problems.push(`${label} console: ${m.text().slice(0, 160)}`));
  page.on('pageerror', (e) => problems.push(`${label} page error: ${e.message.slice(0, 160)}`));
  page.on('response', (r) => r.url().includes('/api/') && r.status() >= 500 && problems.push(`${label} ${r.status()} ${r.request().method()} ${r.url().replace(BASE, '')}`));
  const step = async (name, fn) => {
    try {
      await fn();
      console.log(`✓ [${label}] ${name}`);
    } catch (e) {
      failures++;
      console.log(`✗ [${label}] ${name}\n    ${String(e.message).split('\n')[0]}`);
      await page.screenshot({ path: `${SHOTS}/${label}-${name.replace(/\W+/g, '_')}.png` }).catch(() => {});
    }
  };
  await step('log in', async () => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', 'Password123!');
    await page.click('button[type=submit]');
    await page.waitForURL(/dashboard/);
  });
  return { page, step, context };
}

const dialog = (page) => page.getByRole('dialog');

// streamed AI replies: wait until the text stops growing
async function settledText(locator, timeout = 120_000) {
  await locator.waitFor({ timeout });
  let last = '';
  let stableFor = 0;
  for (const started = Date.now(); Date.now() - started < timeout; ) {
    const now = await locator.innerText();
    stableFor = now === last && now ? stableFor + 500 : 0;
    if (stableFor >= 3000) return now;
    last = now;
    await new Promise((r) => setTimeout(r, 500));
  }
  return last;
}

// Monaco has no plain textarea to fill: focus it, select all, paste the code
async function typeInMonaco(page, scope, code) {
  const editor = scope.locator('.monaco-editor').first();
  await editor.waitFor({ timeout: 45_000 });
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

// ---- library authoring (shared by admin and trainer) ----------------------------------------
async function authorContent({ page, step }, tag) {
  const names = {
    file: `notes-${tag}-${RUN}.pdf`,
    mcq: `What does HTTP 404 mean? (${tag} ${RUN})`,
    code: `Add two numbers ${tag} ${RUN}`,
    sub: `Lesson ${tag} ${RUN}`,
    mod: `Module ${tag} ${RUN}`
  };
  await step('open the content library', async () => {
    await page.goto(`${BASE}/library`);
    await page.getByText('Content library').first().waitFor();
  });
  await step('upload a file', async () => {
    await page.getByRole('button', { name: /^Upload$/ }).first().click();
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
    await dialog(page).locator('input[type=file]').setInputFiles({ name: names.file, mimeType: 'application/pdf', buffer: pdf });
    await dialog(page).getByRole('button', { name: /^Upload$/ }).click();
    await dialog(page).waitFor({ state: 'hidden', timeout: 30_000 });
    await page.getByText(names.file).waitFor();
  });
  await step('create an MCQ', async () => {
    await page.getByRole('button', { name: /Step 2/ }).click();
    await page.getByRole('button', { name: /New MCQ/ }).first().click();
    const d = dialog(page);
    await d.locator('textarea').first().fill(names.mcq);
    for (const [i, text] of ['Not found', 'Server error', 'Redirect', 'Unauthorized'].entries()) {
      await d.getByPlaceholder(`Option ${String.fromCharCode(65 + i)}`).fill(text);
    }
    await d.locator('textarea').nth(1).fill('404 means the server could not find the requested resource.');
    await d.getByRole('button', { name: /Create MCQ/ }).click();
    await d.waitFor({ state: 'hidden' });
    await page.getByText(names.mcq).waitFor();
  });
  await step('create a coding question', async () => {
    await page.getByRole('button', { name: /Step 3/ }).click();
    await page.getByRole('button', { name: /New question/ }).first().click();
    const d = dialog(page);
    await d.getByLabel('Title').fill(names.code);
    await d.locator('textarea').first().fill('Given two integers `a` and `b`, return their sum.');
    // LeetCode-style: addTwo(a: int, b: int) -> int
    await d.getByLabel('Function name').fill('addTwo');
    await d.getByLabel('Parameter 1 name').fill('a');
    await d.getByLabel('Parameter 1 type').selectOption('int');
    await d.getByRole('button', { name: /Add parameter/ }).click();
    await d.getByLabel('Parameter 2 name').fill('b');
    await d.getByLabel('Return type').selectOption('int');
    await d.getByLabel('example 1 input').fill('2\n3');
    await d.getByLabel('example 1 output').fill('5');
    await d.getByRole('checkbox').first().uncheck().catch(() => {});
    await d.getByLabel('Reference solution language').selectOption('javascript');
    await typeInMonaco(page, d, 'var addTwo = function(a, b) { return a + b; };');
    await d.getByRole('button', { name: /Create question/ }).click();
    await d.waitFor({ state: 'hidden', timeout: 30_000 });
    await page.getByText(names.code).waitFor();
  });
  await step('create a submodule from the new items', async () => {
    await page.getByRole('button', { name: /Step 4/ }).click();
    await page.getByRole('button', { name: /New submodule/ }).first().click();
    const d = dialog(page);
    await d.getByLabel('Title').fill(names.sub);
    for (const item of [names.file, names.mcq, names.code]) await d.getByRole('button', { name: new RegExp(item.slice(0, 20).replace(/[()?.]/g, '.')) }).first().click();
    await d.getByRole('button', { name: /Create submodule/ }).click();
    await d.waitFor({ state: 'hidden' });
    await page.getByText(names.sub).waitFor();
  });
  await step('create a module from the submodule', async () => {
    await page.getByRole('button', { name: /Step 5/ }).click();
    await page.getByRole('button', { name: /New module/ }).first().click();
    const d = dialog(page);
    await d.getByLabel('Title').fill(names.mod);
    await d.getByRole('button', { name: new RegExp(names.sub) }).first().click();
    await d.getByRole('button', { name: /Create module/ }).click();
    await d.waitFor({ state: 'hidden' });
    await page.getByText(names.mod).waitFor();
  });
  return names;
}

async function buildCourse({ page, step }, names, courseTitle, fromPath) {
  let courseUrl = '';
  await step('create a course', async () => {
    await page.goto(`${BASE}${fromPath}`);
    await page.getByRole('button', { name: /New course/ }).first().click();
    const d = dialog(page);
    await d.getByLabel('Title').fill(courseTitle);
    await d.locator('textarea').first().fill('Created by the UI end-to-end test.');
    await d.getByRole('button', { name: /Create course/ }).click();
    await d.waitFor({ state: 'hidden' });
  });
  await step('open the course editor', async () => {
    if (!page.url().includes('/admin/course/')) {
      await page.goto(`${BASE}/admin/courses`);
      await page.getByText(courseTitle).first().click();
    }
    await page.waitForURL(/\/admin\/course\//);
    courseUrl = page.url();
  });
  await step('attach the module to the course', async () => {
    await page.getByRole('button', { name: /Add module/ }).first().click();
    const d = dialog(page);
    await d.getByRole('button', { name: new RegExp(names.mod) }).first().click();
    await d.getByRole('button', { name: /^Add module$/ }).click();
    await d.waitFor({ state: 'hidden' });
    await page.getByText(names.mod).first().waitFor();
  });
  await step('publish the course', async () => {
    await page.locator('select').first().selectOption('published');
    await page.waitForTimeout(800);
    await page.reload();
    await page.locator('select').first().waitFor();
    const v = await page.locator('select').first().inputValue();
    if (v !== 'published') throw new Error(`status is ${v}`);
  });
  return courseUrl.split('/').pop();
}

// ============================================================================== admin
{
  const admin = await session('admin', 'admin@example.com');
  const { page, step } = admin;
  await step('dashboard shows real data', async () => {
    await page.getByText('Recent enrollments').waitFor();
    await page.getByText('Top courses').waitFor();
    await page.locator('table tbody tr').first().waitFor();
  });
  await step('assistant chip answers from data', async () => {
    await page.getByRole('button', { name: 'Show popular courses' }).click();
    await page.getByText('Most enrolled courses').waitFor();
  });
  await step('assistant answers a free-text question', async () => {
    await page.getByLabel('Ask Knowhere AI').fill('How many trainers are there?');
    await page.getByLabel('Send').click();
    await page.locator('section', { hasText: 'Knowhere AI' }).getByText(/trainer/i).nth(2).waitFor({ timeout: 45_000 });
    if (await page.getByText(/not configured|unavailable/i).count()) throw new Error('assistant not configured');
  });
  await step('stat tile opens people', async () => {
    await page.getByRole('link', { name: /Trainees/ }).click();
    await page.waitForURL(/admin\/people/);
    await page.locator('text=trainer@example.com >> visible=true').first().waitFor();
  });
  const names = await authorContent(admin, 'admin');
  const courseId = await buildCourse(admin, names, `UI Test Course ${RUN}`, '/admin/dashboard');
  globalThis.adminCourse = { id: courseId, names };
  await admin.context.close();
}

// ============================================================================ trainer
{
  const trainer = await session('trainer', 'trainer@example.com');
  const { page, step } = trainer;
  await step('trainer dashboard loads', async () => {
    await page.getByText('Your courses').waitFor();
    await page.getByText('Leaderboard').waitFor();
  });
  const names = await authorContent(trainer, 'trainer');
  await buildCourse(trainer, names, `Trainer Course ${RUN}`, '/dashboard');
  await trainer.context.close();
}

// ============================================================================ student
{
  const student = await session('student', 'student@example.com');
  const { page, step } = student;
  const { id, names } = globalThis.adminCourse || {};
  await step('find the new course in the catalog', async () => {
    await page.goto(`${BASE}/courses`);
    await page.getByText('Browse all', { exact: true }).click();
    await page.getByText(`UI Test Course ${RUN}`).first().click();
    await page.waitForURL(new RegExp(`/course/${id}`));
  });
  await step('enroll', async () => {
    await page.getByRole('button', { name: /Enroll in this course/ }).click();
    await page.getByText(/viewing the syllabus/).waitFor({ state: 'detached' });
  });
  await step('answer the MCQ', async () => {
    await page.getByRole('link', { name: new RegExp(names.mcq.slice(0, 25).replace(/[()?.]/g, '.')) }).first().click();
    await page.getByRole('radio', { name: /Not found/ }).click();
    await page.getByRole('button', { name: 'Check answer' }).click();
    await page.getByText(/Correct/).first().waitFor();
  });
  await step('open the resource', async () => {
    await page.goto(`${BASE}/course/${id}`);
    await page.getByRole('link', { name: new RegExp(names.file.replace('.', '.')) }).first().click();
    await page.locator('iframe, a[href*="http"]').first().waitFor();
  });
  await step('solve the coding question on the server', async () => {
    await page.goto(`${BASE}/course/${id}`);
    await page.getByRole('link', { name: new RegExp(names.code) }).first().click();
    await page.getByLabel('Language').selectOption('python');
    await typeInMonaco(page, page, 'class Solution:\n    def addTwo(self, a: int, b: int) -> int:\n        return a + b');
    // a custom case: its expected output comes from the trainer's reference solution
    await page.getByRole('button', { name: 'Add a test case' }).click();
    await page.getByLabel('a =').fill('10');
    await page.getByLabel('b =').fill('32');
    await page.getByRole('button', { name: /^Run$/ }).click();
    await page.getByRole('heading', { name: 'Accepted' }).waitFor({ timeout: 60_000 });
    await page.getByRole('button', { name: /Case 2/ }).click();
    // Output and Expected both 42 (expected computed by the reference solution)
    await page.locator('pre', { hasText: /^\s*42\s*$/ }).nth(1).waitFor();
    await page.getByRole('button', { name: /^Submit$/ }).click();
    await page.getByText(/testcases passed/).waitFor({ timeout: 60_000 });
    await page.getByRole('heading', { name: 'Accepted' }).waitFor();
    await page.getByRole('button', { name: 'Submissions' }).click();
    await page.getByRole('cell', { name: /Accepted/ }).first().waitFor();
  });
  await step('post in the course community', async () => {
    await page.goto(`${BASE}/course/${id}/community`);
    const msg = `Hello from the UI test ${RUN}`;
    await page.getByPlaceholder(/Message #general/).fill(msg);
    await page.keyboard.press('Enter');
    await page.getByText(msg).first().waitFor();
  });
  await step('join the voice room', async () => {
    await page.getByText('study-room').first().click();
    await page.getByRole('button', { name: /Join voice/ }).click();
    await page.getByRole('button', { name: /Leave/ }).waitFor({ timeout: 20_000 });
    if (await page.getByText(/could not|invalid|blocked/i).count()) throw new Error('voice error shown');
    await page.getByRole('button', { name: /Leave/ }).click();
  });
  await step('AI coach gives a practice plan from tracked behaviour', async () => {
    await page.goto(`${BASE}/coach`);
    await page.getByLabel('Coach course').selectOption({ label: `UI Test Course ${RUN}` });
    // the profile reflects what this run just did (quiz, resource, code)
    await page.getByText('Focused time').waitFor({ timeout: 60_000 });
    await page.getByRole('button', { name: 'How should I practise this week?' }).click();
    const answer = page.locator('.prose-sm').first();
    const text = await settledText(answer);
    if (text.length < 80 || /not configured|unavailable|failed/i.test(text)) throw new Error(`coach said: ${text.slice(0, 120)}`);
  });
  await student.context.close();
}

// ======================================================================== mentor (staff)
{
  const admin = await session('mentor', 'admin@example.com');
  const { page, step } = admin;
  await step('cohort roster and learner mentoring', async () => {
    await page.goto(`${BASE}/coach`);
    await page.getByLabel('Coach course').selectOption({ label: `UI Test Course ${RUN}` });
    await page.getByText(/Learners \(\d+\)/).waitFor({ timeout: 90_000 });
    await page.getByRole('button', { name: /Alex|student/i }).first().click();
    await page.getByRole('button', { name: 'How should I talk to this learner?' }).click();
    const answer = page.locator('.prose-sm').first();
    const text = await settledText(answer);
    if (text.length < 80 || /not configured|unavailable|failed/i.test(text)) throw new Error(`mentor said: ${text.slice(0, 120)}`);
  });
  await admin.context.close();
}

await browser.close();
if (problems.length) {
  console.log('\nproblems seen during the run:');
  for (const p of [...new Set(problems)].slice(0, 30)) console.log('  -', p);
}
console.log(failures ? `\n${failures} step(s) FAILED` : '\nALL UI STEPS PASSED');
process.exit(failures || problems.length ? 1 : 0);
