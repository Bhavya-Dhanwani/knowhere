import { findSimilar } from '../src/modules/ranking/similarity.js';
import { pickCode } from '../src/modules/ai/rubric.agent.js';

// a realistic 40-line program, parameterised so each student's is genuinely different
const program = (name: string, op: string, length = 40) =>
  Array.from(
    { length },
    (_, i) => `  const ${name}Value${i} = compute${name}(input${i} ${op} ${i * 7}, "${name}-${i}");`
  ).join('\n');
const template = Array.from(
  { length: 30 },
  (_, i) => `  // starter: setupRouterHandler${i}(app, config.options[${i}]);`
)
  .map((l) => l.replace('// ', ''))
  .join('\n');

describe('Copying between students', () => {
  it('flags a copy (even reformatted), ignores the shared starter template, and flags a shared repo', () => {
    const docs = [
      {
        id: 'a',
        name: 'Alice',
        repoUrl: 'https://github.com/alice/app',
        snippets: { 'app.js': template + '\n' + program('alice', '+') }
      },
      // Bob copied Alice and reindented it: whitespace changes must not hide it
      {
        id: 'b',
        name: 'Bob',
        repoUrl: 'https://github.com/bob/app',
        snippets: {
          'src/main.js':
            template +
            '\n' +
            program('alice', '+').replace(/  /g, '\t\t') +
            '\nconsole.log("bob was here and added a line");'
        }
      },
      {
        id: 'c',
        name: 'Cara',
        repoUrl: 'https://github.com/cara/app',
        snippets: { 'app.js': template + '\n' + program('cara', '*', 10) }
      },
      {
        id: 'd',
        name: 'Dev',
        repoUrl: 'https://github.com/dev/app',
        snippets: { 'index.js': template + '\n' + program('dev', '-', 10) }
      },
      { id: 'e', name: 'Eve', repoUrl: 'https://github.com/cara/app.git', snippets: {} }
    ];
    const flags = findSimilar(docs);
    const pairs = flags.map((f) => [f.subAName, f.subBName].sort().join('+'));
    expect(pairs).toContain('Alice+Bob');
    expect(pairs).toContain('Cara+Eve'); // same repository submitted twice
    // 28 of Cara's 36 code windows are the starter template: only the template exclusion keeps
    // this pair unflagged
    expect(pairs).not.toContain('Cara+Dev');
    expect(pairs).not.toContain('Alice+Cara');
    const ab = flags.find((f) => f.subAName === 'Alice' && f.subBName === 'Bob')!;
    expect(ab.similarity).toBeGreaterThan(0.9);
    expect(ab.sharedExamples[0]).toMatch(/app\.js:\d+ ~ src\/main\.js:\d+/);
  });
});

describe('Model-picked files', () => {
  it('reads the files the model chose for this rubric first, even over keyword matches', () => {
    const pad = (s: string) => s + ' '.repeat(3000);
    const { files } = pickCode(
      {
        'src/state.js': pad('state management everywhere'), // keyword-rich but not the real thing
        'src/store/reducer.js': pad('function reducer(s, a) { switch (a.type) {} }'),
        'README.md': pad('# app')
      },
      {
        keywords: ['state', 'management'],
        paths: [],
        chosen: ['src/store/reducer.js']
      },
      3200 // room for one file
    );
    expect(files.map((f) => f.path)).toEqual(['src/store/reducer.js']);
  });
});

describe('Copying in a small cohort', () => {
  it('a copied pair is not mistaken for a shared template (their code is in 2 of 4 submissions)', () => {
    const docs = [
      {
        id: '1',
        name: 'Kilo',
        repoUrl: 'https://github.com/a/kilo',
        snippets: { 'kilo.c': program('kilo', '+') }
      },
      {
        id: '2',
        name: 'Copycat',
        repoUrl: 'https://github.com/b/editor',
        snippets: { 'editor.c': program('kilo', '+') }
      },
      {
        id: '3',
        name: 'Py',
        repoUrl: 'https://github.com/c/py',
        snippets: { 'main.py': program('py', '*') }
      },
      {
        id: '4',
        name: 'Web',
        repoUrl: 'https://github.com/d/web',
        snippets: { 'app.js': program('web', '-') }
      }
    ];
    const flags = findSimilar(docs);
    expect(flags.map((f) => `${f.subAName}+${f.subBName}`)).toEqual(['Kilo+Copycat']);
    expect(flags[0].similarity).toBe(1);
  });
});
