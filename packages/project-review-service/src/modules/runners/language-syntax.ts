// The little each language needs for static metrics: how comments look, how functions and tests
// are declared, what counts as a branch, and which calls are dangerous. One table instead of
// per-language code paths; anything unknown falls back to C-style syntax.

export interface Syntax {
  name: string;
  line: string[]; // line-comment prefixes
  block: Array<[string, string]>; // block-comment delimiters
  fn: RegExp; // a function/method declaration; capture group 1..n = its name
  logicalWords?: boolean; // `and` / `or` are branch operators
}

const C_LIKE_FN = new RegExp(
  [
    // JS/TS: function foo(  |  const foo = (...) =>  |  const foo = async x =>
    String.raw`^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(`,
    String.raw`^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>`,
    // Go func (with receiver), Rust fn, Kotlin fun, Swift func
    String.raw`^(?:pub(?:\([^)]*\))?\s+|public\s+|private\s+|internal\s+|override\s+|static\s+|async\s+)*(?:fn|func|fun)\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)`,
    // C/C++/Java/C#/Dart/PHP: <modifiers/return type> name(args) [const] [throws X] [{]
    String.raw`^(?:[\w<>\[\],.*&:?]+\s+)+[*&]*([A-Za-z_]\w*)\s*\([^;{}]*\)\s*(?:const\s*)?(?:noexcept\s*)?(?:throws\s+[\w.,\s]+)?\{?\s*$`,
    // method shorthand with the brace on the same line: name(args) {
    String.raw`^([A-Za-z_$][\w$]*)\s*\([^;{}]*\)\s*\{\s*$`
  ].join('|')
);

const TABLE: Array<[RegExp, Syntax]> = [
  [
    /\.(py|pyw|pyi)$/i,
    {
      name: 'Python',
      line: ['#'],
      block: [
        ['"""', '"""'],
        ["'''", "'''"]
      ],
      fn: /^(?:async\s+)?def\s+([A-Za-z_]\w*)/,
      logicalWords: true
    }
  ],
  [
    /\.(rb|rake)$/i,
    {
      name: 'Ruby',
      line: ['#'],
      block: [['=begin', '=end']],
      fn: /^def\s+(?:self\.)?([\w?!]+)/,
      logicalWords: true
    }
  ],
  [
    /\.(ex|exs)$/i,
    { name: 'Elixir', line: ['#'], block: [], fn: /^defp?\s+([\w?!]+)/, logicalWords: true }
  ],
  [
    /\.(sh|bash|zsh)$|(^|\/)(makefile|dockerfile)$/i,
    {
      name: 'Shell',
      line: ['#'],
      block: [],
      fn: /^(?:function\s+)?([A-Za-z_][\w-]*)\s*\(\s*\)\s*\{?/
    }
  ],
  [
    /\.(ps1|psm1)$/i,
    { name: 'PowerShell', line: ['#'], block: [['<#', '#>']], fn: /^function\s+([\w-]+)/i }
  ],
  [
    /\.(ya?ml|toml|ini|cfg|conf|r|pl|pm|nim|cmake)$|cmakelists\.txt$/i,
    { name: 'Script/config', line: ['#'], block: [], fn: /^(?:sub|function)\s+([A-Za-z_]\w*)/ }
  ],
  [
    /\.(sql|lua|hs|elm|ada|adb)$/i,
    {
      name: 'SQL/Lua/Haskell',
      line: ['--'],
      block: [
        ['/*', '*/'],
        ['--[[', ']]'],
        ['{-', '-}']
      ],
      fn: /^(?:local\s+)?function\s+([\w.:]+)|^([a-z]\w*)\s*::/
    }
  ],
  [
    /\.(asm|s|inc|clj|cljs|lisp|el|scm)$/i,
    { name: 'Assembly/Lisp', line: [';'], block: [], fn: /^([A-Za-z_.]\w*):|^\(defn?-?\s+([\w-]+)/ }
  ],
  [/\.(html?|xml|svg|xaml)$/i, { name: 'Markup', line: [], block: [['<!--', '-->']], fn: /^\b$/ }],
  [/\.(css|less)$/i, { name: 'CSS', line: [], block: [['/*', '*/']], fn: /^\b$/ }],
  [
    /\.(scss|sass)$/i,
    { name: 'SCSS', line: ['//'], block: [['/*', '*/']], fn: /^@(?:mixin|function)\s+([\w-]+)/ }
  ],
  [/\.(md|txt|rst|json|lock|csv)$/i, { name: 'Text', line: [], block: [], fn: /^\b$/ }]
];
const C_LIKE: Syntax = { name: 'C-family', line: ['//'], block: [['/*', '*/']], fn: C_LIKE_FN };
const TEXT: Syntax = { name: 'Text', line: [], block: [], fn: /^\b$/ };

/** Source files in a real programming language (what "code" means for ratios like typing). */
export const CODE_FILE =
  /\.(c|h|cc|cpp|cxx|hpp|hh|m|mm|cs|fs|java|kt|kts|scala|groovy|go|rs|swift|dart|js|mjs|cjs|jsx|ts|tsx|vue|svelte|py|rb|php|pl|lua|r|ex|exs|erl|hs|elm|clj|cljs|ml|zig|nim|sol|sh|bash|ps1)$/i;

export const syntaxFor = (path: string): Syntax => {
  const known = TABLE.find(([re]) => re.test(path))?.[1];
  if (known) return known;
  // LICENSE, TODO, CHANGELOG, AUTHORS...: prose, not code (Makefile/Dockerfile matched above)
  const base = path.split('/').pop() || path;
  return base.includes('.') ? C_LIKE : TEXT;
};

/** Keywords that look like `name(...)` declarations but are control flow or calls. */
export const NOT_A_FUNCTION =
  /^(if|for|foreach|while|switch|catch|return|else|do|sizeof|new|case|throw|typeof|await|yield|elif|with|using|lock|synchronized|when|match|until|unless|super|this)$/;

/** First captured name of a function declaration on this (trimmed) line, if any. */
export const functionName = (syntax: Syntax, trimmed: string): string | null => {
  const m = trimmed.match(syntax.fn);
  const name = m?.slice(1).find(Boolean);
  return name && !NOT_A_FUNCTION.test(name) ? name : null;
};

/** Branch points for cyclomatic complexity, any language. */
export const branchCount = (syntax: Syntax, trimmed: string): number =>
  (
    trimmed.match(
      /\b(if|elif|elsif|else\s+if|for|foreach|while|until|unless|catch|except|rescue|case|when)\b|\?\?|&&|\|\||\?[^:?.]+:/g
    ) || []
  ).length + (syntax.logicalWords ? (trimmed.match(/\b(and|or)\b/g) || []).length : 0);

/** Test files by the conventions of every mainstream ecosystem. */
export const isTestPath = (path: string) =>
  /(^|\/)(tests?|__tests__|spec|specs|test_?suite|src\/test)\/|(^|\/)test_[^/]+$|[._-](test|spec)\.[^/]+$|_test\.(go|py|c|cc|cpp|rs|exs)$|Tests?\.(java|kt|cs|swift|scala)$|_spec\.rb$/i.test(
    path
  );

/** A test case declaration, with the framework it implies. */
export const TEST_CASES: Array<[RegExp, string]> = [
  [/\b(it|test)\s*\(\s*['"`]/, 'Jest/Vitest/Mocha/node:test'],
  [/^\s*(async\s+)?def\s+test_\w*\s*\(/, 'pytest/unittest'],
  [/@(Test|ParameterizedTest|RepeatedTest)\b/, 'JUnit'],
  [/^\s*func\s+Test\w*\s*\(\s*\w+\s+\*testing\.T/, 'Go testing'],
  [/#\[(tokio::)?test\]/, 'Rust test'],
  [/\b(TEST|TEST_F|TEST_P)\s*\(/, 'GoogleTest'],
  [/\b(TEST_CASE|SECTION)\s*\(\s*"/, 'Catch2'],
  [/\bit\s+['"][^'"]+['"]\s+do\b/, 'RSpec'],
  [/\[(Fact|Theory|Test|TestMethod)\]/, 'xUnit/NUnit/MSTest'],
  [/^\s*(void\s+)?test\w*\s*\(\s*(void)?\s*\)\s*\{/, 'C test functions'],
  [/\btest\s+"[^"]+"\s+do\b/, 'ExUnit']
];

/** Statically typed languages: typing is a property of the language, not a bonus to earn. */
export const STATIC_TYPED =
  /\.(ts|tsx|java|kt|kts|scala|cs|fs|go|rs|swift|dart|c|h|cc|cpp|cxx|hpp|hh|m|mm|hs|elm)$/i;

/** Dangerous calls per language: [path, pattern, rule id, message]. */
export const UNSAFE_CALLS: Array<[RegExp, RegExp, string, string]> = [
  [
    /\.(c|h|cc|cpp|cxx|hpp)$/i,
    /\bgets\s*\(/,
    'c.gets',
    'gets() has no bounds check (removed from C11): buffer overflow'
  ],
  [
    /\.(c|h|cc|cpp|cxx|hpp)$/i,
    /\b(strcpy|strcat|sprintf|vsprintf)\s*\(/,
    'c.unbounded-string',
    'Unbounded string copy/format: prefer strncpy/snprintf'
  ],
  [
    /\.(c|h|cc|cpp|cxx|hpp)$/i,
    /\bscanf\s*\(\s*"[^"]*%s/,
    'c.scanf-s',
    'scanf("%s") without a width can overflow its buffer'
  ],
  [
    /\.(c|h|cc|cpp|cxx|hpp|py|rb|php|pl)$/i,
    /\bsystem\s*\(/,
    'shell.system',
    'system() runs a shell command: injection risk with any user input'
  ],
  [/\.py$/i, /\b(eval|exec)\s*\(/, 'python.eval', 'eval/exec executes arbitrary code'],
  [
    /\.py$/i,
    /\bpickle\.loads?\s*\(|\byaml\.load\s*\((?![^)]*Loader)/,
    'python.unsafe-deserialize',
    'Unsafe deserialization (pickle / yaml.load without SafeLoader)'
  ],
  [
    /\.py$/i,
    /shell\s*=\s*True|\bos\.system\s*\(/,
    'python.shell',
    'Shell command execution: injection risk'
  ],
  [
    /\.(java|kt)$/i,
    /Runtime\.getRuntime\(\)\.exec\s*\(/,
    'java.runtime-exec',
    'Runtime.exec runs OS commands'
  ],
  [
    /\.(java|kt)$/i,
    /new\s+ObjectInputStream\s*\(/,
    'java.deserialize',
    'Java deserialization of untrusted data'
  ],
  [/\.php$/i, /\b(eval|shell_exec|passthru|exec)\s*\(/, 'php.unsafe', 'Code/command execution'],
  [
    /\.(js|mjs|cjs|jsx|ts|tsx)$/i,
    /\beval\s*\(|new\s+Function\s*\(/,
    'javascript.eval',
    'eval()/new Function executes arbitrary code'
  ],
  [
    /\.(js|mjs|cjs|jsx|ts|tsx)$/i,
    /document\.write\s*\(|\.innerHTML\s*=(?!=)|dangerouslySetInnerHTML/,
    'javascript.xss-sink',
    'Raw HTML sink: XSS risk with user data'
  ],
  [
    /\.(js|mjs|cjs|ts)$/i,
    /child_process[\s\S]{0,40}\bexec\s*\(|\bexec\s*\(\s*`/,
    'javascript.shell',
    'Shell command execution: injection risk'
  ],
  // SQL built by string concatenation / interpolation, any language
  [
    /./,
    /["'`]\s*(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[^"'`]*["'`]\s*(\+|%|\.format\()|\bf["'](SELECT|INSERT|UPDATE|DELETE)\b.*\{|`(SELECT|INSERT|UPDATE|DELETE)\b[^`]*\$\{/i,
    'sql.injection',
    'SQL built from strings: use parameterised queries'
  ]
];
