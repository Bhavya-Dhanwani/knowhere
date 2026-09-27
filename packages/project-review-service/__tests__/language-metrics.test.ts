import { CodeAnalysisRunner } from '../src/modules/runners/code-analysis.runner.js';

const metrics = (files: Record<string, string>) =>
  CodeAnalysisRunner.computeDeterministicMetrics(files, Object.keys(files), [], [], []);

describe('Engineering metrics are language-neutral', () => {
  it('C: #include is code, if/for are not functions, main is, gtest-free C tests are counted', () => {
    const m = metrics({
      'src/list.c': [
        '#include <stdio.h>',
        '/* a linked list',
        '   with a block comment */',
        '// line comment',
        'int length(Node *n) {',
        '  int c = 0;',
        '  for (; n; n = n->next) {',
        '    if (n->v > 0 && n->v < 9) c++;',
        '  }',
        '  return c;',
        '}',
        'int main(void) {',
        '  if (length(0) == 0) return 0;',
        '  return 1;',
        '}'
      ].join('\n'),
      'tests/test_list.c': 'void test_length(void) {\n  assert(length(0) == 0);\n}\n'
    });
    expect(m.linesOfCode.commentLines).toBe(3); // block (2) + line (1); #include is code
    expect(m.cyclomaticComplexity.maxComplexity).toBe(4); // length(): 1 + for + if + &&
    expect(m.testMetrics.testCaseCount).toBe(1);
    expect(m.typeSafety.staticTyping).toBe(true);
  });

  it('Python: # comments, def + elif/and, pytest tests, type hints count as typing', () => {
    const m = metrics({
      'app/calc.py': [
        '# calculator',
        'def grade(score: int) -> str:',
        '    if score > 90 and score <= 100:',
        '        return "A"',
        '    elif score > 50:',
        '        return "B"',
        '    return "C"',
        'def add(a: int, b: int) -> int:',
        '    return a + b',
        'def sub(a: int, b: int) -> int:',
        '    return a - b'
      ].join('\n'),
      'tests/test_calc.py':
        'from app.calc import add\ndef test_add():\n    assert add(1, 2) == 3\ndef test_neg():\n    assert add(-1, 1) == 0\n'
    });
    expect(m.linesOfCode.commentLines).toBe(1);
    expect(m.cyclomaticComplexity.maxComplexity).toBe(4); // grade(): 1 + if + and + elif
    expect(m.testMetrics.testCaseCount).toBe(2);
    expect(m.testMetrics.testFrameworks).toContain('pytest/unittest');
    expect(m.typeSafety.staticTyping).toBe(true);
  });

  it('Java + Go: methods and receivers are functions, @Test / func TestX are tests', () => {
    const m = metrics({
      'src/main/java/shop/Cart.java':
        'public class Cart {\n  public static void main(String[] args) {\n    System.out.println(1);\n  }\n  private int total(List<Item> items) throws IOException {\n    return 0;\n  }\n}\n',
      'src/test/java/shop/CartTest.java':
        'class CartTest {\n  @Test\n  void totalIsZero() { assertEquals(0, 0); }\n}\n',
      'server/handler.go':
        'func (s *Server) Handle(w http.ResponseWriter, r *http.Request) {\n  if r == nil { return }\n}\n',
      'server/handler_test.go': 'func TestHandle(t *testing.T) {\n  t.Log("ok")\n}\n'
    });
    expect(m.cyclomaticComplexity.averagePerFunction).toBeGreaterThan(0);
    expect(m.testMetrics.testCaseCount).toBe(2);
    expect(m.testMetrics.testFrameworks).toEqual(expect.arrayContaining(['JUnit', 'Go testing']));
  });

  it('flags dangerous calls in C, Python and SQL-by-string in any language', async () => {
    const r = await CodeAnalysisRunner.analyze(
      'local',
      {
        'main.c': 'int main(void) {\n  char b[8];\n  gets(b);\n  strcpy(b, "x");\n}\n',
        'db.py':
          'def find(name):\n    cur.execute(f"SELECT * FROM users WHERE name = \'{name}\'")\n',
        'safe.py': '# eval( in a comment is fine\nprint("hi")\n'
      },
      ['main.c', 'db.py', 'safe.py']
    );
    const rules = r.semgrep.findings.map((f) => f.ruleId);
    expect(rules).toEqual(
      expect.arrayContaining([
        'security.c.gets',
        'security.c.unbounded-string',
        'security.sql.injection'
      ])
    );
    expect(rules.some((x) => x.includes('python.eval'))).toBe(false);
  }, 30000);
});

describe('Prose files are not code', () => {
  it('a C repo with LICENSE/TODO/README is still statically typed, and license text has no functions', () => {
    const m = CodeAnalysisRunner.computeDeterministicMetrics(
      {
        'kilo.c': 'int main(int argc, char **argv) {\n  if (argc < 2) return 1;\n  return 0;\n}\n',
        LICENSE:
          'Copyright (c) 2016 Someone (see AUTHORS) {\nPermission is hereby granted (free of charge) {\n',
        TODO: 'Improve search (maybe regex) {\n',
        'README.md': '# Kilo\n'
      },
      ['kilo.c', 'LICENSE', 'TODO', 'README.md', 'Makefile'],
      [],
      [],
      []
    );
    expect(m.typeSafety.staticTyping).toBe(true);
    expect(m.cyclomaticComplexity.averagePerFunction).toBe(1); // only main(): 1 branch over 1 function
  });
});
