// Self-check for a running judge-runner: `node check.mjs [url] [proxyPort]` (default
// http://localhost:5010). With a registry-proxy port, dependency fetching is checked too.
// Exercises every language plus the sandbox walls (network, writes, loops, memory, fork bombs).
import assert from 'node:assert/strict';

const url = process.argv[2] || 'http://localhost:5010';
const run = async (language, code, inputs = [''], timeLimitMs = 1500) =>
  (await fetch(`${url}/run`, { method: 'POST', body: JSON.stringify({ language, code, inputs, timeLimitMs }) })).json();
const first = async (...a) => (await run(...a)).results[0];

const inputs = Array.from({ length: 20 }, (_, i) => `2\n${i} ${i}`);
const sums = {
  python: 'import sys\nd=sys.stdin.read().split()\nprint(sum(map(int,d[1:])))',
  cpp: '#include <bits/stdc++.h>\nint main(){long long n,x,s=0;std::cin>>n;while(n--){std::cin>>x;s+=x;}std::cout<<s;}',
  java: 'import java.util.*;public class Main{public static void main(String[] a){Scanner s=new Scanner(System.in);int n=s.nextInt();long t=0;while(n-->0)t+=s.nextLong();System.out.print(t);}}'
};
for (const [lang, code] of Object.entries(sums)) {
  const r = await run(lang, code, inputs);
  assert.deepEqual(r.results.map((x) => x.output.trim()), inputs.map((_, i) => String(2 * i)), `${lang} sums`);
}

assert.equal((await run('cpp', 'int main( {')).compile.ok, false, 'compile errors reported');
assert.match((await first('python', 'while True: pass')).error, /Time limit/, 'infinite loop killed');
assert.equal((await first('python', 'x = bytearray(2*1024**3)')).ok, false, 'memory capped');
assert.equal((await first('python', 'import os\nwhile True: os.fork()')).ok, false, 'fork bomb contained');
assert.equal(
  (await first('python', 'import urllib.request\nurllib.request.urlopen("http://1.1.1.1", timeout=2)')).ok,
  false,
  'no network'
);
assert.equal((await first('python', 'open("/usr/pwned","w")')).ok, false, 'system is read-only');
assert.equal((await first('python', 'open("main.py","w")')).ok, false, 'program dir is read-only at run time');
assert.equal((await first('python', 'import os\nprint(os.getuid())')).output.trim(), '65534', 'runs as nobody');
// ---- whole projects (/project): build + tests, offline ----
const { execFileSync } = await import('node:child_process');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const { join, dirname } = await import('node:path');
// a GitHub-style tarball: everything under one top-level folder
const tarball = (files) => {
  const root = mkdtempSync(join(tmpdir(), 'proj-'));
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(root, 'repo-sha', p)), { recursive: true });
    writeFileSync(join(root, 'repo-sha', p), c);
  }
  // relative paths: some tar builds read 'C:\...' as a remote host
  execFileSync('tar', ['-czf', 'a.tgz', 'repo-sha'], { cwd: root });
  return readFileSync(join(root, 'a.tgz'));
};
// node:http, not fetch: a project run can take longer than fetch's 5-minute header timeout
const { request } = await import('node:http');
const project = (files, extra = {}) =>
  new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify({ archive: tarball(files).toString('base64'), ...extra }));
    const req = request(`${url}/project`, { method: 'POST', headers: { 'Content-Length': data.length } }, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('end', () => resolve(JSON.parse(text)));
    });
    req.on('error', reject);
    req.end(data);
  });
const step = (r, name) => r.steps.find((s) => s.name.startsWith(name));

const cOk = await project({
  'Makefile': 'app: main.c\n\tgcc -Wall -o app main.c\ntest: app\n\t./app | grep -q 42\n',
  'main.c': '#include <stdio.h>\nint main(void){printf("42\\n");return 0;}\n'
});
assert.equal(step(cOk, 'build').ok, true, 'C project builds with make');
assert.equal(step(cOk, 'tests').ok, true, 'make test runs');

const cBad = await project({ 'main.c': 'int main( {' });
assert.equal(step(cBad, 'build').ok, false, 'compile error reported');
assert.match(step(cBad, 'build').output, /error/, 'compiler output returned');

const py = await project({
  'calc.py': 'def add(a, b):\n    return a + b\n',
  'tests/test_calc.py': 'from calc import add\ndef test_ok():\n    assert add(2, 2) == 4\ndef test_bad():\n    assert add(2, 2) == 5\n'
});
assert.deepEqual(step(py, 'tests').tests, { passed: 1, failed: 1 }, 'pytest pass/fail counted');

const node = await project({
  'package.json': JSON.stringify({ scripts: { test: 'node --test' }, devDependencies: { ms: '^2.1.3' } }),
  'index.js': 'module.exports = 1;\n'
});
assert.equal(step(node, 'syntax').ok, true, 'node syntax checked');
if (!process.argv[3])
  // without a registry proxy, dependency-needing steps are reported, never faked
  assert.match(step(node, 'tests').skipped, /not installed/, 'dependency-needing tests reported, not faked');

const goProj = await project({
  'go.mod': 'module example.com/calc\n\ngo 1.19\n',
  'calc.go': 'package calc\n\nfunc Add(a, b int) int { return a + b }\n',
  'calc_test.go':
    'package calc\n\nimport "testing"\n\nfunc TestAdd(t *testing.T) {\n\tif Add(2, 2) != 4 {\n\t\tt.Fatal("bad")\n\t}\n}\n\nfunc TestWrong(t *testing.T) {\n\tif Add(2, 2) == 4 {\n\t\tt.Fatal("expected failure")\n\t}\n}\n'
});
assert.equal(step(goProj, 'build').ok, true, 'go builds offline');
assert.deepEqual(step(goProj, 'tests').tests, { passed: 1, failed: 1 }, 'go test counted');

const rust = await project({
  'Cargo.toml': '[package]\nname = "calc"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n',
  'src/lib.rs': 'pub fn add(a: i32, b: i32) -> i32 { a + b }\n#[cfg(test)]\nmod tests {\n    use super::*;\n    #[test]\n    fn adds() { assert_eq!(add(2, 2), 4); }\n}\n'
});
assert.equal(step(rust, 'build').ok, true, 'rust builds offline');
assert.deepEqual(step(rust, 'tests').tests, { passed: 1, failed: 0 }, 'cargo test counted');

const rustDeps = await project({
  'Cargo.toml': '[package]\nname = "x"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\nserde = "1"\n',
  'src/main.rs': 'fn main() {}\n'
});
assert.match(step(rustDeps, 'build').skipped, /not supported/, 'crates needing download reported, not faked');

const net = await project({
  'Makefile': 'all:\n\tpython3 -c "import urllib.request; urllib.request.urlopen(\'http://1.1.1.1\', timeout=3)"\n'
});
assert.equal(step(net, 'build').ok, false, 'no network during builds either');

// ---- organiser stdin -> stdout cases (DSA) ----
const dsa = await project(
  { 'sum.c': '#include <stdio.h>\nint main(void){long a,b;scanf("%ld %ld",&a,&b);printf("%ld\\n",a+b);return 0;}\n' },
  { ioTests: [{ name: 'small', input: '2 3', expected: '5' }, { name: 'big', input: '1000000 2000000', expected: '3000000\n' }, { name: 'wrong on purpose', input: '1 1', expected: '3' }] }
);
assert.deepEqual(step(dsa, 'io tests').tests, { passed: 2, failed: 1 }, 'organiser io cases judged');
assert.match(step(dsa, 'io tests').output, /wrong on purpose/, 'failing case named');

// ---- C++ GoogleTest project that downloads googletest at configure time (FetchContent) ----
const gtest = await project({
  'CMakeLists.txt':
    'cmake_minimum_required(VERSION 3.14)\nproject(dsa CXX)\nset(CMAKE_CXX_STANDARD 17)\ninclude(FetchContent)\nFetchContent_Declare(googletest URL https://github.com/google/googletest/archive/refs/tags/v1.14.0.zip)\nFetchContent_MakeAvailable(googletest)\nenable_testing()\nadd_executable(t test.cpp)\ntarget_link_libraries(t GTest::gtest_main)\ninclude(GoogleTest)\ngtest_discover_tests(t)\n',
  'test.cpp': '#include <gtest/gtest.h>\nint add(int a,int b){return a+b;}\nTEST(Add, Works){EXPECT_EQ(add(2,2),4);}\nTEST(Add, Wrong){EXPECT_EQ(add(2,2),5);}\n'
});
assert.equal(step(gtest, 'build').ok, true, 'googletest served from the image, not downloaded');
assert.deepEqual(step(gtest, 'tests').tests, { passed: 1, failed: 1 }, 'ctest counts gtest cases');

// ---- dependency fetch through the registry proxy (skipped when the judge has none) ----
if (process.argv[3]) {
  // MERN-style repo: server/ with npm deps + MongoDB tests + Express start, client/ with a build
  const mern = await project({
    'server/package.json': JSON.stringify({
      scripts: { test: 'node --test', start: 'node index.js' },
      dependencies: { express: '^4.19.2', mongodb: '^6.8.0' }
    }),
    'server/index.js':
      "const express = require('express');\nconst app = express();\napp.get('/', (q, r) => r.json({ ok: true }));\napp.listen(process.env.PORT || 3000);\n",
    'server/db.test.js':
      "const { test } = require('node:test');\nconst assert = require('node:assert');\nconst { MongoClient } = require('mongodb');\ntest('writes and reads mongo', async () => {\n  const c = await MongoClient.connect(process.env.MONGO_URI);\n  await c.db().collection('t').insertOne({ x: 1 });\n  assert.equal((await c.db().collection('t').findOne()).x, 1);\n  await c.close();\n});\n",
    'client/package.json': JSON.stringify({ scripts: { build: 'node build.js' } }),
    'client/build.js': "require('fs').writeFileSync('bundle.js', 'ok');\n"
  });
  assert.equal(step(mern, 'dependencies (npm) [server]').ok, true, 'npm install via proxy');
  assert.deepEqual(step(mern, 'tests (npm test) [server]').tests, { passed: 1, failed: 0 }, 'tests used MongoDB');
  assert.equal(step(mern, 'app starts (npm start) [server]').ok, true, 'express app answered HTTP');
  assert.equal(step(mern, 'build (npm run build) [client]').ok, true, 'client folder built');

  const gitDep = await project({
    'package.json': JSON.stringify({ scripts: { test: 'node --test' }, dependencies: { evil: 'git+https://github.com/x/evil.git' } }),
    'index.js': '1;\n'
  });
  assert.match(step(gitDep, 'dependencies').skipped, /refused/, 'git dependencies refused');
  assert.match(step(gitDep, 'tests').skipped, /not installed|did not install/, 'and nothing runs without them');

  const py = await project({
    'requirements.txt': 'six==1.16.0\n',
    'test_six.py': 'import six\ndef test_six():\n    assert six.PY3\n'
  });
  assert.equal(step(py, 'dependencies (pip)').ok, true, 'pip wheels via proxy');

  // a real repo pin with no prebuilt wheel (lazy-object-proxy 1.3.1, 2017): our wheels-only rule
  // refuses it, which must be neutral, and the stdlib-only tests must still run and count
  const noWheel = await project({
    'requirements.txt': 'lazy-object-proxy==1.3.1\n',
    'test_math.py': 'def test_add():\n    assert 1 + 1 == 2\n'
  });
  assert.equal(step(noWheel, 'dependencies (pip)').ok, null, 'our install restriction is neutral');
  assert.match(step(noWheel, 'dependencies (pip)').skipped, /Not counted against the project/);
  assert.deepEqual(step(noWheel, 'tests').tests, { passed: 1, failed: 0 }, 'tests still ran');
  assert.deepEqual(step(py, 'tests').tests, { passed: 1, failed: 0 }, 'pytest used the fetched wheel');

  const maven = await project({
    'pom.xml':
      '<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>x</groupId><artifactId>calc</artifactId><version>1</version><properties><maven.compiler.release>17</maven.compiler.release><project.build.sourceEncoding>UTF-8</project.build.sourceEncoding></properties><dependencies><dependency><groupId>org.junit.jupiter</groupId><artifactId>junit-jupiter</artifactId><version>5.10.2</version><scope>test</scope></dependency></dependencies><build><plugins><plugin><groupId>org.apache.maven.plugins</groupId><artifactId>maven-compiler-plugin</artifactId><version>3.13.0</version></plugin><plugin><groupId>org.apache.maven.plugins</groupId><artifactId>maven-surefire-plugin</artifactId><version>3.2.5</version></plugin></plugins></build></project>',
    'src/main/java/calc/Calc.java': 'package calc;\npublic class Calc { public static int add(int a, int b) { return a + b; } }\n',
    'src/test/java/calc/CalcTest.java':
      'package calc;\nimport org.junit.jupiter.api.Test;\nimport static org.junit.jupiter.api.Assertions.*;\nclass CalcTest {\n  @Test void adds() { assertEquals(4, Calc.add(2, 2)); }\n  @Test void wrong() { assertEquals(5, Calc.add(2, 2)); }\n}\n'
  });
  assert.equal(step(maven, 'build (maven)').ok, true, `maven compiled offline: ${step(maven, 'build (maven)').output}`);
  const mt = step(maven, 'tests (maven)');
  assert.deepEqual(mt.tests, { passed: 1, failed: 1 }, `maven JUnit 5 tests ran offline: ${mt.skipped || mt.output}`);

  // the proxy itself: registries only
  const http = await import('node:http');
  const connect = (host) =>
    new Promise((resolve) => {
      const r = http.request({ host: '127.0.0.1', port: Number(process.argv[3]), method: 'CONNECT', path: `${host}:443` });
      r.on('connect', (res, socket) => (socket.destroy(), resolve(res.statusCode)));
      r.on('error', () => resolve(0));
      r.end();
    });
  assert.equal(await connect('registry.npmjs.org'), 200, 'proxy allows the npm registry');
  assert.equal(await connect('example.com'), 403, 'proxy refuses anything else');
  assert.equal(await connect('169.254.169.254'), 403, 'proxy refuses cloud metadata');
} else console.log('(no proxy port given: dependency-fetch checks skipped)');

assert.equal((await (await fetch(`${url}/health`)).json()).status, 'ok', 'runner survives the abuse');
console.log('judge-runner: all checks passed');
