import { checkFormResponses } from '../src/modules/review/review.validator.js';
import { runPool } from '../src/modules/workflows/workflow.runner.js';
import { toHeadToHead, buildDossier } from '../src/modules/ranking/head-to-head.agent.js';
import {
  parseGithubRepo,
  isSourceFile,
  isTextContent,
  sourcePriority
} from '../src/modules/runners/discovery.runner.js';
import { pickCode, focusKeywords } from '../src/modules/ai/rubric.agent.js';
import { auditLiveSite, isPrivateIp, metricScore } from '../src/modules/runners/live-site.audit.js';

describe('Event custom form, batch pool, head-to-head', () => {
  const fields = [
    { id: 'video', label: 'Demo video', type: 'url' as const, required: true },
    {
      id: 'track',
      label: 'Track',
      type: 'select' as const,
      required: false,
      options: ['AI', 'Web']
    },
    { id: 'size', label: 'Team size', type: 'number' as const, required: false }
  ];

  it('validates form answers against the event form and drops unknown keys', () => {
    expect(
      checkFormResponses(fields, { video: ' https://youtu.be/x ', track: 'AI', hacker: 'x' })
    ).toEqual({ video: 'https://youtu.be/x', track: 'AI' });
    expect(() => checkFormResponses(fields, {})).toThrow('"Demo video" is required');
    expect(() => checkFormResponses(fields, { video: 'javascript:alert(1)' })).toThrow('URL');
    expect(() => checkFormResponses(fields, { video: 'https://a.b', track: 'Games' })).toThrow(
      'one of'
    );
    expect(() => checkFormResponses(fields, { video: 'https://a.b', size: 'four' })).toThrow(
      'number'
    );
  });

  it('runs at most `limit` items at once and survives failures', async () => {
    let inFlight = 0;
    let peak = 0;
    const done: number[] = [];
    await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      peak = Math.max(peak, ++inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      if (n === 4) throw new Error('boom');
      done.push(n);
    });
    expect(peak).toBe(3);
    expect(done.sort()).toEqual([1, 2, 3, 5, 6, 7]);
  });

  it('maps a blind A/B verdict back to teams and flags disagreement with the ranking', () => {
    const d = (team: string) => ({
      id: team,
      dossier: buildDossier(team, { overallScore: 1 }, null)
    });
    const [first, second] = [d('b-team'), d('a-team')]; // a-team sorts first, so it is "A"
    const verdict = {
      winner: 'A' as const,
      verdict: 'x'.repeat(40),
      decisiveFactors: [],
      whereLoserWasBetter: [],
      loserToOvertake: ['y']
    };
    const h = toHeadToHead(verdict, second, first, first);
    expect(h.winnerTeam).toBe('a-team');
    expect(h.vsTeam).toBe('b-team');
    expect(h.agreesWithRanking).toBe(false);
    expect(toHeadToHead({ ...verdict, winner: 'B' }, second, first, first).agreesWithRanking).toBe(
      true
    );
  });
});

describe('Live-site audit', () => {
  it('refuses private, loopback and cloud-metadata addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.20.0.5',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '::1',
      'fd00::1',
      '::ffff:10.0.0.1'
    ])
      expect(isPrivateIp(ip)).toBe(true);
    for (const ip of ['8.8.8.8', '140.82.112.3', '172.32.0.1', '2606:4700::1111'])
      expect(isPrivateIp(ip)).toBe(false);
  });

  it('scores web vitals on a Lighthouse-style curve', () => {
    expect(metricScore(1000, 2500, 4000)).toBe(100);
    expect(metricScore(4000, 2500, 4000)).toBe(50);
    expect(metricScore(8000, 2500, 4000)).toBe(0);
  });

  it('catches a JS app that renders blank, in a real browser', async () => {
    const page = (html: string) => 'data:text/html,' + encodeURIComponent(html);
    const good = await auditLiveSite(
      page(
        `<html lang="en"><head><title>T</title><meta name="viewport" content="width=device-width"></head><body><div id="r"></div><script>r.innerHTML='<main><h1>Hello there, this is rendered</h1></main>'</script></body></html>`
      )
    );
    if (!good) return console.warn('no Chrome/Edge on this machine: browser test skipped');
    const blank = await auditLiveSite(
      page(
        `<html><head><title>T</title></head><body><div id="r"></div><script>throw new Error('x')</script></body></html>`
      )
    );
    expect(good.liveError).toBeUndefined();
    expect(good.lighthouse.performance).toBeGreaterThan(80);
    expect(blank!.liveError).toMatch(/blank/);
    expect(blank!.lighthouse.performance).toBe(0);
    expect(blank!.consoleErrorsCount).toBeGreaterThan(0);
  }, 60000);
});

describe('Repository URLs students actually submit', () => {
  it('normalises them to owner/repo, and rejects non-repos', () => {
    const cases: Array<[string, string | null]> = [
      ['https://github.com/27Aman/CSS-.git', '27Aman/CSS-'],
      ['https://github.com/asadusmani403/protfolio/tree/main', 'asadusmani403/protfolio'],
      ['https://GitHub.com/Nexus-hiraK/Portfolio_project', 'Nexus-hiraK/Portfolio_project'],
      [
        'https://github.com/sahilgyan72-lgtm/JOB-THEFT-AUTO-ft-linkedin-.git',
        'sahilgyan72-lgtm/JOB-THEFT-AUTO-ft-linkedin-'
      ],
      ['https://yashikajindal81.github.io/Bakery-website/', 'yashikajindal81/Bakery-website'],
      ['https://anmhrn712.github.io/', 'anmhrn712/anmhrn712.github.io'],
      ['https://github.com/anvsha5', null],
      ['NA', null],
      ['https://nogithub.com/reject', null],
      ['https://nogithub.com/a/b', null],
      ['github.com/me/site', 'me/site']
    ];
    for (const [url, want] of cases) {
      const got = parseGithubRepo(url);
      expect(got ? `${got.owner}/${got.repo}` : null).toBe(want);
    }
  });
});

describe('Which files the grader reads (any stack, steered by the organiser)', () => {
  it('keeps real source for every stack and drops build output, lockfiles and minified code', () => {
    for (const f of [
      'src/App.tsx',
      'src/components/Card.jsx',
      'app/page.tsx',
      'src/App.vue',
      'lib/main.dart',
      'api/views.py',
      'src/main/java/App.java',
      'cmd/server.go',
      'Dockerfile',
      'prisma/schema.prisma'
    ])
      expect(isSourceFile(f)).toBe(true);
    for (const f of [
      'package-lock.json',
      'dist/assets/index-3f2a.js',
      'node_modules/react/index.js',
      '.next/server/app.js',
      'public/vendor/jquery.min.js',
      'build/static/js/main.js.map',
      'logo.png'
    ])
      expect(isSourceFile(f)).toBe(false);
  });

  it('reads the files the organiser cares about first, whatever the framework', () => {
    const pad = (s: string) => s + ' '.repeat(3000);
    const snippets: Record<string, string> = {
      'index.html': pad('<div id="root"></div><script type="module" src="/src/main.jsx"></script>'),
      'README.md': pad('# My todo app'),
      'vite.config.js': pad('export default defineConfig({})'),
      'src/components/TodoItem.jsx': pad(
        'export function TodoItem({ todo }) { return <li>{todo.text}</li> }'
      ),
      'src/hooks/useTodos.js': pad(
        'export function useTodos() { const [todos, setTodos] = useState([]); /* state management */ }'
      ),
      'src/api/auth.js': pad('export async function login() {}'),
      'package-lock.json': pad('{}')
    };
    const { files, skipped } = pickCode(
      snippets,
      {
        keywords: focusKeywords('Reward custom hooks and clean state management.'),
        paths: ['/api/auth']
      },
      9500 // room for three files
    );
    const read = files.map((f) => f.path);
    expect(read).toContain('src/hooks/useTodos.js'); // matches the organiser's words
    expect(read).toContain('src/api/auth.js'); // a requirement points at it
    expect(read).not.toContain('package-lock.json');
    expect(skipped).toContain('README.md');
  });
});

describe('Stack-agnostic: C, Java, Node, anything', () => {
  it('reads any text source (even unlisted languages) and skips binaries and build output', () => {
    for (const f of [
      'main.c',
      'src/list.h',
      'Makefile',
      'src/main/java/com/app/Main.java',
      'pom.xml',
      'bin/www',
      'routes/users.js',
      'lib/app.ex',
      'sketch/blink.ino',
      'boot.asm',
      'src/lib.rs',
      'CMakeLists.txt'
    ])
      expect(isSourceFile(f)).toBe(true);
    for (const f of [
      'a.out.o',
      'target/classes/Main.class',
      'build/app.exe',
      'libfoo.so',
      'cmake-build-debug/main.c',
      'go.sum',
      'fonts/inter.woff2'
    ])
      expect(isSourceFile(f)).toBe(false);
    expect(isTextContent('int main(void) { return 0; }')).toBe(true);
    expect(isTextContent('\u007fELF\u0002\u0001\u0001\u0000\u0000')).toBe(false);
  });

  it('puts entry points first in any language', () => {
    for (const entry of ['main.c', 'src/main/java/Main.java', 'server.js', 'app.py', 'cmd/main.go'])
      expect(sourcePriority(entry)).toBeLessThan(sourcePriority('docs/guide.md'));
  });

  it('follows the organiser: a C event about memory reads the malloc code, a Java event about REST reads the controller', () => {
    const pad = (s: string) => s + ' '.repeat(3000);
    const c = pickCode(
      {
        'README.md': pad('# Linked list'),
        'src/utils.c': pad('int add(int a, int b) { return a + b; }'),
        'src/list.c': pad('Node *n = malloc(sizeof *n); /* ... */ free(n);'),
        'tests/test_list.c': pad('assert(1);')
      },
      {
        keywords: focusKeywords('Judge memory management: every malloc must have a matching free.'),
        paths: []
      },
      3200 // room for one file
    );
    expect(c.files.map((f) => f.path)).toEqual(['src/list.c']);

    const java = pickCode(
      {
        'README.md': pad('# Shop'),
        'src/main/java/shop/util/Strings.java': pad('class Strings {}'),
        'src/main/java/shop/web/OrderController.java': pad(
          '@RestController class OrderController { @GetMapping("/orders") }'
        )
      },
      { keywords: focusKeywords('Reward a clean REST controller layer'), paths: ['/orders'] },
      3200
    );
    expect(java.files.map((f) => f.path)).toEqual(['src/main/java/shop/web/OrderController.java']);
  });
});
