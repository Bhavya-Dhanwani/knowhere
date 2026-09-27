// Judge runner: compiles and runs learner programs (stdin -> stdout) for Python, C++ and Java.
// Every compile and every test case runs in its own bubblewrap sandbox: fresh user, pid, net,
// ipc, uts and mount namespaces (so no network), a read-only system, all capabilities dropped,
// rlimits on memory/files/processes and a hard wall-clock kill. Nothing survives between runs.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { chmod, lstat, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.PORT || 5010);
const MAX_BODY = 8 * 1024 * 1024;
const OUTPUT_CAP = 1024 * 1024;
const WORKERS = Math.max(1, Number(process.env.JUDGE_CONCURRENCY) || os.cpus().length);
// allowlisting proxy for package registries (see proxy.mjs); empty = dependency fetch disabled
const REGISTRY_PROXY = process.env.REGISTRY_PROXY || '';
// shared download cache for the fetch phase only (npm + pip: content-addressed, so one team's
// packages can never stand in for another's); empty = no cache
const CACHE_DIR = process.env.JUDGE_CACHE_DIR || '';

const LANGS = {
  python: { file: 'main.py', run: ['python3', '-I', '-B', 'main.py'] },
  cpp: {
    file: 'main.cpp',
    compile: ['g++', '-O2', '-std=c++17', '-pipe', '-o', 'main', 'main.cpp'],
    run: ['./main']
  },
  java: {
    file: 'Main.java',
    compile: ['javac', '-J-Xmx384m', '-encoding', 'UTF-8', 'Main.java'],
    run: ['java', '-Xmx256m', '-Xss64m', '-XX:+UseSerialGC', '-XX:TieredStopAtLevel=1', 'Main'],
    jvm: true
  }
};

// one sandboxed process; resolves with its output, never throws.
// `net` is only set for the dependency-fetch phase of /project, which runs our own hardened
// package-manager commands (never student code) and reaches the internet only through the
// allowlisting registry proxy (REGISTRY_PROXY; the pod's NetworkPolicy allows nothing else).
function sandbox(argv, { dir, writable, stdin = '', timeMs, jvm, net = false }) {
  const limits = [
    'prlimit',
    '--fsize=16777216', // 16MB files
    '--nofile=256',
    '--nproc=256',
    '--core=0',
    // the JVM reserves far more address space than it uses; -Xmx bounds its heap instead
    ...(jvm ? [] : ['--as=536870912'])
  ];
  const args = [
    '--unshare-all', ...(net ? ['--share-net'] : []), '--unshare-user', '--uid', '65534', '--gid', '65534',
    '--die-with-parent', '--new-session', '--cap-drop', 'ALL',
    '--ro-bind', '/usr', '/usr', '--ro-bind', '/etc', '/etc',
    '--symlink', 'usr/bin', '/bin', '--symlink', 'usr/lib', '/lib', '--symlink', 'usr/sbin', '/sbin',
    ...(process.arch === 'x64' ? ['--symlink', 'usr/lib64', '/lib64'] : []),
    '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp',
    writable ? '--bind' : '--ro-bind', dir, '/box', '--chdir', '/box',
    ...(net && CACHE_DIR ? ['--bind', CACHE_DIR, '/cache'] : []),
    '--clearenv', '--setenv', 'PATH', '/usr/local/bin:/usr/bin:/bin',
    '--setenv', 'HOME', '/tmp', '--setenv', 'LANG', 'C.UTF-8',
    ...(net
      ? ['HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy'].flatMap((k) => ['--setenv', k, REGISTRY_PROXY])
      : []),
    '--', ...limits, '--', ...argv
  ];
  return new Promise((resolve) => {
    const started = process.hrtime.bigint();
    const child = spawn('bwrap', args, { stdio: ['pipe', 'pipe', 'pipe'], detached: true });
    let stdout = '';
    let stderr = '';
    let killed = null;
    const kill = (why) => {
      if (killed) return;
      killed = why;
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    };
    const timer = setTimeout(() => kill('Time limit exceeded'), timeMs);
    child.stdout.on('data', (d) => {
      stdout += d;
      if (stdout.length > OUTPUT_CAP) kill('Output limit exceeded');
    });
    child.stderr.on('data', (d) => (stderr = (stderr + d).slice(-4000)));
    child.stdin.on('error', () => undefined);
    child.stdin.end(stdin);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const timeMs = Number(process.hrtime.bigint() - started) / 1e6;
      resolve({ ok: !killed && code === 0, code, signal, killed, stdout, stderr, timeMs: Math.round(timeMs) });
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, killed: `Sandbox failed: ${e.message}`, stdout: '', stderr: '', timeMs: 0 });
    });
  });
}

// ==================== whole-project build + test (/project) ====================
// The caller (project-review-service) posts a repo tarball; this pod fetches nothing itself.
// Phase 1 (fetch): our own hardened package-manager commands only, with network ONLY through the
//   allowlisting registry proxy; no student code runs (npm --ignore-scripts, wheels only,
//   Maven Central only, Go module proxy only).
// Phase 2 (build + tests + run): no network at all, same sandbox as /run; databases the tests
//   need (MongoDB) run inside the sandbox on localhost.
const PROJECT_MAX = 40 * 1024 * 1024; // JSON body with a base64 archive of up to ~25MB
const STEP_MS = Number(process.env.PROJECT_STEP_MS) || 180_000;
const FETCH_MS = Number(process.env.PROJECT_FETCH_MS) || 300_000;
let projectSlots = Math.max(1, Number(process.env.PROJECT_CONCURRENCY) || 1);
const waiting = [];
const acquire = () =>
  projectSlots > 0 ? (projectSlots--, Promise.resolve()) : new Promise((r) => waiting.push(r));
const release = () => (waiting.length ? waiting.shift()() : projectSlots++);

// relative paths of regular files (symlinks skipped: never follow an untrusted link from here)
async function listFiles(root, rel = '', out = []) {
  for (const e of await readdir(path.join(root, rel), { withFileTypes: true })) {
    if (out.length > 20_000) break;
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (!/^(\.git|node_modules|target|build|dist|out|\.venv|venv|__pycache__|_m2|_gomod|_pydeps)$/.test(e.name))
        await listFiles(root, p, out);
    } else if (e.isFile()) out.push(p);
  }
  return out;
}
const readSmall = async (root, rel) => {
  try {
    const full = path.join(root, rel);
    const st = await lstat(full);
    return st.isFile() && st.size < 256_000 ? await readFile(full, 'utf8') : '';
  } catch {
    return '';
  }
};

const q = (files) => files.map((f) => `'${f.replace(/'/g, `'\\''`)}'`).join(' ');
const isTest = (f) => /(^|\/)(tests?|__tests__|spec|src\/test)\/|(_test|\.test|\.spec|Test)\.\w+$|(^|\/)test_[^/]*$/.test(f);

// ---- dependency manifests are untrusted: only plain registry specs are ever fetched ----
/** npm: semver ranges, dist-tags and npm: aliases only (no git, URLs, files, user/repo). */
const unsafeNpmSpecs = (pkg) =>
  Object.entries({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies })
    .filter(([, v]) => {
      const spec = String(v).replace(/^npm:[@\w./-]+@/, '');
      return !/^[\w.*^~<>=|\s-]*$/.test(spec) || /^\w+:/.test(spec);
    })
    .map(([k, v]) => `${k}@${v}`);

/** pip: "name[extras] <specifiers> ; markers" lines only (no options, URLs, paths, includes). */
const pipRequirements = (text) => {
  const ok = [];
  const bad = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '').trim();
    if (!line || line.startsWith('#')) continue;
    if (/^[A-Za-z0-9][A-Za-z0-9._-]*(\[[A-Za-z0-9,._-]+\])?\s*((===?|>=|<=|~=|!=|>|<)\s*[A-Za-z0-9.*+!_-]+\s*,?\s*)*(;[^@]*)?$/.test(line))
      ok.push(line);
    else bad.push(line);
  }
  return { ok, bad };
};
const pyprojectDeps = (toml) => {
  const m = toml.match(/^\s*dependencies\s*=\s*\[([\s\S]*?)\]/m);
  return m ? [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]).join('\n') : '';
};

// start MongoDB inside the (offline) sandbox for projects that use it; every common env name.
// Journal files capped at 8MB and diagnostics off: mongod's default 100MB journal preallocation
// would be killed by the sandbox's 16MB per-file limit
const withMongo = (cmd) =>
  `mkdir -p /tmp/db && (mongod --dbpath /tmp/db --bind_ip 127.0.0.1 --port 27017 --quiet --nounixsocket --wiredTigerCacheSizeGB 0.25 --wiredTigerEngineConfigString "log=(file_max=8MB)" --setParameter diagnosticDataCollectionEnabled=false >/tmp/mongod.log 2>&1 &) && ` +
  `for i in $(seq 1 60); do (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null && break; sleep 0.25; done; ` +
  `export MONGO_URI=mongodb://127.0.0.1:27017/judge MONGODB_URI=mongodb://127.0.0.1:27017/judge MONGO_URL=mongodb://127.0.0.1:27017/judge DATABASE_URL=mongodb://127.0.0.1:27017/judge MONGOMS_SYSTEM_BINARY=/usr/local/bin/mongod; ${cmd}`;

// a server "starts" if it answers any HTTP status on $PORT within 60s
const smokeStart = (startCmd) =>
  `export PORT=4000 NODE_ENV=production; (${startCmd} >/tmp/app.log 2>&1 &); ` +
  `for i in $(seq 1 60); do c=$(node -e "fetch('http://127.0.0.1:4000/').then(r=>console.log(r.status)).catch(()=>{})"); ` +
  `if [ -n "$c" ]; then echo "App answered HTTP $c on GET / (port 4000)"; exit 0; fi; sleep 1; done; ` +
  `echo "App did not answer HTTP on port 4000 within 60s. Last output:"; tail -40 /tmp/app.log; exit 1`;

const mavenSettings = () => {
  const p = REGISTRY_PROXY && new URL(REGISTRY_PROXY);
  return `<settings><mirrors><mirror><id>central-only</id><mirrorOf>*</mirrorOf><url>https://repo.maven.apache.org/maven2</url></mirror></mirrors>${
    p ? `<proxies><proxy><id>judge</id><active>true</active><protocol>https</protocol><host>${p.hostname}</host><port>${p.port || 80}</port></proxy></proxies>` : ''
  }</settings>`;
};

/**
 * What to run, from the files present, for every project folder in the repo (repo root and any
 * folder up to 2 levels down holding a manifest: client/, server/, backend/api/...).
 * Step: { name, cmd, cwd, kind: fetch|build|test|run, jvm?, net?, why?, note?, files? }
 */
async function planSteps(root, files) {
  const steps = [];
  const MANIFEST = /^(package\.json|requirements\.txt|pyproject\.toml|pom\.xml|build\.gradle(\.kts)?|go\.mod|Cargo\.toml|CMakeLists\.txt|(GNU)?[Mm]akefile)$/;
  const dirs = [
    ...new Set(
      files
        .filter((f) => MANIFEST.test(f.split('/').pop()) && f.split('/').length <= 3)
        .map((f) => f.split('/').slice(0, -1).join('/'))
    )
  ].sort();
  if (!dirs.includes('')) dirs.unshift(''); // loose sources at the root
  const canFetch = !!REGISTRY_PROXY;
  const offlineWhy = 'dependency download is not configured (REGISTRY_PROXY)';

  for (const dir of dirs) {
    const at = (name) => (dir ? `${dir}/${name}` : name);
    const label = (s) => (dir ? `${s} [${dir}]` : s);
    const own = files.filter((f) => (dir ? f.startsWith(`${dir}/`) : true));
    // files that belong to this folder and not to a nested project folder of its own
    const mine = own.filter((f) => !dirs.some((d) => d !== dir && d.startsWith(dir ? `${dir}/` : '') && d && f.startsWith(`${d}/`)));
    const has = (name) => files.includes(at(name));
    const src = (re) => mine.filter((f) => re.test(f) && !isTest(f)).map((f) => (dir ? f.slice(dir.length + 1) : f));
    const push = (s) => steps.push({ cwd: dir, ...s, name: label(s.name) });

    // ---- C / C++ ----
    const makefile = ['Makefile', 'makefile', 'GNUmakefile'].find(has);
    const cFiles = src(/\.c$/);
    const cppFiles = src(/\.(cpp|cc|cxx)$/);
    if (makefile) {
      push({ kind: 'build', name: 'build (make)', cmd: 'make -j2' });
      if (/^(test|check)\s*:/m.test(await readSmall(root, at(makefile))))
        push({ kind: 'test', name: 'tests (make test)', cmd: 'make test || make check' });
    } else if (has('CMakeLists.txt')) {
      // FetchContent(googletest/catch2) would download at configure time: use the copies in this
      // image instead (find_package first, never touch the network)
      push({
        kind: 'build',
        name: 'build (cmake)',
        cmd: 'cmake -S . -B _build -DCMAKE_BUILD_TYPE=Debug -DFETCHCONTENT_TRY_FIND_PACKAGE_MODE=ALWAYS -DFETCHCONTENT_SOURCE_DIR_GOOGLETEST=/usr/src/googletest -DFETCHCONTENT_FULLY_DISCONNECTED=ON >/dev/null && cmake --build _build -j2'
      });
      if (/enable_testing|add_test|gtest_discover_tests|catch_discover_tests/.test(await readSmall(root, at('CMakeLists.txt'))))
        push({ kind: 'test', name: 'tests (ctest)', cmd: 'ctest --test-dir _build --output-on-failure' });
    } else if (cppFiles.length) {
      push({ kind: 'build', name: 'build (g++)', cmd: `g++ -std=c++17 -O2 -Wall -Wextra -o _app ${q(cppFiles)} -lm`, produces: './_app' });
    } else if (cFiles.length) {
      push({ kind: 'build', name: 'build (gcc)', cmd: `gcc -std=c11 -O2 -Wall -Wextra -o _app ${q(cFiles)} -lm`, produces: './_app' });
    }

    // ---- Java ----
    const javaFiles = src(/\.java$/);
    if (has('pom.xml')) {
      const settings = '-B -q -s _judge_settings.xml -Dmaven.repo.local=_m2';
      // go-offline alone misses plugin runtime deps and Surefire's test-framework providers (they
      // are looked up while tests run), so resolve plugins too and fetch the providers explicitly,
      // using the versions this project resolved. Only the dependency plugin runs: no build phase,
      // so nothing from the project executes while the network is on.
      const dep = 'org.apache.maven.plugins:maven-dependency-plugin:3.6.1';
      const get = (artifact) => `mvn ${settings} ${dep}:get -Dtransitive=true -Dartifact=${artifact} || true`;
      const fetchCmd = [
        'rm -rf .mvn',
        `mvn ${settings} ${dep}:go-offline ${dep}:resolve-plugins`,
        // Surefire version the project pins, else Maven's default
        `S=$(tr -d '

	 ' < pom.xml | grep -o '<artifactId>maven-surefire-plugin</artifactId><version>[^<]*' | sed 's/.*<version>//'); S=\${S:-2.12.4}`,
        `for p in surefire-junit-platform surefire-junit4 surefire-junit47; do ${get('org.apache.maven.surefire:$p:$S')}; done`,
        `for v in $(ls _m2/org/junit/platform/junit-platform-engine 2>/dev/null); do ${get('org.junit.platform:junit-platform-launcher:$v')}; done`
      ].join(' && ');
      push({ kind: 'fetch', name: 'dependencies (maven)', net: true, jvm: true, writeSettings: true,
        cmd: canFetch ? fetchCmd : null, why: canFetch ? undefined : offlineWhy });
      push({ kind: 'build', name: 'build (maven)', jvm: true, cmd: `mvn ${settings} -o test-compile` });
      if (javaFiles.length || mine.some((f) => /src\/test\/java\//.test(f)))
        push({ kind: 'test', name: 'tests (maven)', jvm: true, cmd: `mvn ${settings} -o test` });
    } else if (javaFiles.length) {
      const gradle = has('build.gradle') || has('build.gradle.kts');
      push({
        kind: 'build',
        name: 'build (javac)',
        cmd: `mkdir -p _classes && javac -J-Xmx384m -encoding UTF-8 -Xlint:all -cp "/usr/share/java/*" -d _classes ${q(javaFiles)}`,
        jvm: true,
        note: gradle
          ? 'Gradle build scripts run code while resolving, so Gradle is never run here: sources were compiled with plain javac and third-party libraries will not resolve.'
          : undefined,
        produces: 'java'
      });
    }

    // ---- Python ----
    const pyFiles = src(/\.py$/);
    const pyAll = mine.filter((f) => /\.py$/.test(f));
    if (pyAll.length) {
      const reqText = (await readSmall(root, at('requirements.txt'))) || pyprojectDeps(await readSmall(root, at('pyproject.toml')));
      const reqs = pipRequirements(reqText);
      const usesMongo = /\b(pymongo|motor|mongoengine|beanie)\b/i.test(reqText);
      if (reqs.ok.length || reqs.bad.length) {
        push(
          reqs.bad.length
            ? { kind: 'fetch', name: 'dependencies (pip)', why: `refused non-registry requirements: ${reqs.bad.slice(0, 3).join(' | ')}` }
            : canFetch
              ? { kind: 'fetch', name: 'dependencies (pip)', net: true, writeReqs: reqs.ok,
                  cmd: `python3 -m pip install --disable-pip-version-check --no-input --only-binary=:all: --break-system-packages --target _pydeps --index-url https://pypi.org/simple ${CACHE_DIR ? '--cache-dir /cache/pip' : '--no-cache-dir'} -r _judge_reqs.txt` }
              : { kind: 'fetch', name: 'dependencies (pip)', why: offlineWhy }
        );
      }
      const py = 'PYTHONPATH="$PWD/_pydeps:$PWD" PYTHONDONTWRITEBYTECODE=1';
      push({ kind: 'build', name: 'syntax (python)', cmd: `python3 -m compileall -q -x "(^|/)(\\.venv|venv|_pydeps)/" .` });
      if (pyAll.some(isTest)) {
        const t = `${py} python3 -m pytest -q -p no:cacheprovider --ignore=_pydeps`;
        push({ kind: 'test', name: 'tests (pytest)', jvm: usesMongo, cmd: usesMongo ? withMongo(t) : t });
      }
      if (!dir && pyFiles.includes('main.py')) push({ kind: 'meta', produces: `${py} python3 main.py` });
    }

    // ---- Node / MERN ----
    const jsFiles = src(/\.(js|mjs|cjs)$/).filter((f) => !/(^|\/)(public|static|assets|vendor)\//.test(f));
    // node, like the JVM, reserves far more address space than it uses: `jvm` lifts the --as cap
    if (jsFiles.length)
      push({ kind: 'build', name: 'syntax (node)', jvm: true, cmd: `for f in ${q(jsFiles.slice(0, 400))}; do node --check "$f" || exit 1; done` });
    if (has('package.json')) {
      let pkg = null;
      try {
        pkg = JSON.parse(await readSmall(root, at('package.json')));
      } catch {
        push({ kind: 'build', name: 'package.json', why: 'package.json is not valid JSON' });
      }
      if (pkg) {
        const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
        const unsafe = unsafeNpmSpecs(pkg);
        let installed = deps.length === 0;
        if (deps.length) {
          if (unsafe.length) push({ kind: 'fetch', name: 'dependencies (npm)', why: `refused non-registry dependencies: ${unsafe.slice(0, 3).join(', ')}` });
          else if (!canFetch) push({ kind: 'fetch', name: 'dependencies (npm)', why: offlineWhy });
          else {
            const flags = '--ignore-scripts --no-audit --no-fund --loglevel=error --registry=https://registry.npmjs.org/';
            const cache = CACHE_DIR ? 'npm_config_cache=/cache/npm ' : '';
            push({ kind: 'fetch', name: 'dependencies (npm)', net: true, jvm: true,
              cmd: `rm -f .npmrc; if [ -f package-lock.json ]; then ${cache}npm ci ${flags}; else ${cache}npm install ${flags}; fi` });
            installed = true;
          }
        }
        const usesMongo = deps.some((d) => /^(mongoose|mongodb|@typegoose\/typegoose|mongodb-memory-server)$/.test(d));
        const run = (name, script) => {
          const cmd = `npm run ${script} --silent`;
          return installed
            ? { kind: script === 'test' ? 'test' : 'build', name, jvm: true, cmd: usesMongo && script === 'test' ? withMongo(cmd) : cmd }
            : { kind: script === 'test' ? 'test' : 'build', name, why: 'npm dependencies were not installed' };
        };
        if (pkg.scripts?.build) push(run('build (npm run build)', 'build'));
        if (pkg.scripts?.test && !/no test specified/.test(pkg.scripts.test)) push(run('tests (npm test)', 'test'));
        const isServer = deps.some((d) => /^(express|koa|fastify|@nestjs\/core|@hapi\/hapi|hapi|next)$/.test(d));
        if (isServer && pkg.scripts?.start) {
          push(
            installed
              ? { kind: 'run', name: 'app starts (npm start)', jvm: true, cmd: usesMongo ? withMongo(smokeStart('npm start --silent')) : smokeStart('npm start --silent') }
              : { kind: 'run', name: 'app starts (npm start)', why: 'npm dependencies were not installed' }
          );
        }
      }
    }

    // ---- Go ----
    if (has('go.mod')) {
      const needsModules = /^\s*require/m.test(await readSmall(root, at('go.mod')));
      const go = 'GOFLAGS=-mod=mod GOTOOLCHAIN=local GOMODCACHE="$PWD/_gomod"';
      if (needsModules)
        push(canFetch
          ? { kind: 'fetch', name: 'dependencies (go)', net: true, jvm: true, cmd: `${go} GOPROXY=https://proxy.golang.org GOSUMDB=sum.golang.org go mod download` }
          : { kind: 'fetch', name: 'dependencies (go)', why: offlineWhy });
      push({ kind: 'build', name: 'build (go)', jvm: true, cmd: `${go} GOPROXY=off go build ./... && ${go} GOPROXY=off go vet ./...` });
      if (mine.some((f) => /_test\.go$/.test(f)))
        push({ kind: 'test', name: 'tests (go test)', jvm: true, cmd: `${go} GOPROXY=off go test -v ./...` });
    }

    // ---- Rust (crates.io needs a newer cargo than this image ships: dependency-free crates only) ----
    if (has('Cargo.toml')) {
      const manifest = await readSmall(root, at('Cargo.toml'));
      const needsCrates = manifest
        .split(/^(?=\[)/m)
        .some((sec) => /^\[(dev-|build-|target\..*\.)?dependencies(\.[^\]]+)?\]/.test(sec) && /^\s*[\w-]+\s*=|^\[[^\]]*dependencies\.[^\]]+\]/m.test(sec));
      if (needsCrates) push({ kind: 'build', name: 'build (cargo)', why: 'crate downloads are not supported by this judge image' });
      else {
        // no debug info (ours, or the statically linked std's): keeps test binaries under the
        // sandbox's 16MB file limit; pass/fail needs none
        const rust = "CARGO_PROFILE_DEV_DEBUG=0 CARGO_PROFILE_TEST_DEBUG=0 RUSTFLAGS='-C strip=debuginfo' CARGO_TERM_COLOR=never";
        push({ kind: 'build', name: 'build (cargo)', jvm: true, cmd: `${rust} cargo build --offline --quiet` });
        push({ kind: 'test', name: 'tests (cargo test)', jvm: true, cmd: `${rust} cargo test --offline --quiet` });
      }
    }
  }
  return steps;
}

// pytest "12 passed, 1 failed", TAP "# pass 3 / # fail 0", jest "Tests: 1 failed, 3 passed",
// ctest "x tests failed out of y", Surefire "Tests run: 5, Failures: 1, Errors: 0", cargo, go -v
function testCounts(output) {
  const cargoRuns = [...output.matchAll(/test result: \w+\. (\d+) passed; (\d+) failed/g)];
  if (cargoRuns.length)
    return cargoRuns.reduce((t, m) => ({ passed: t.passed + +m[1], failed: t.failed + +m[2] }), { passed: 0, failed: 0 });
  const surefire = [...output.matchAll(/Tests run: (\d+), Failures: (\d+), Errors: (\d+), Skipped: (\d+)/g)].pop();
  if (surefire) {
    const [run, fail, err, skip] = surefire.slice(1).map(Number);
    return { passed: run - fail - err - skip, failed: fail + err };
  }
  const jest = output.match(/Tests:\s+(?:(\d+) failed, )?(?:\d+ skipped, )?(\d+) passed/);
  if (jest) return { passed: +jest[2], failed: +(jest[1] || 0) };
  const goPass = (output.match(/^\s*--- PASS:/gm) || []).length;
  const goFail = (output.match(/^\s*--- FAIL:/gm) || []).length;
  if (goPass + goFail) return { passed: goPass, failed: goFail };
  const n = (re) => Number(output.match(re)?.[1] ?? NaN);
  const ctestFailed = n(/(\d+) tests? failed out of \d+/);
  const ctestTotal = n(/tests? failed out of (\d+)/);
  const passed = [n(/(\d+) passed/), n(/# pass\s+(\d+)/), ctestTotal - ctestFailed].find(Number.isFinite);
  const failed = [n(/(\d+) failed/), n(/# fail\s+(\d+)/), ctestFailed].find(Number.isFinite);
  return passed === undefined && failed === undefined ? undefined : { passed: passed ?? 0, failed: failed ?? 0 };
}

// a failure that is really "a dependency is missing", in any ecosystem
const MISSING_DEPENDENCY =
  /ModuleNotFoundError|No module named|Cannot find module|ERR_MODULE_NOT_FOUND|Cannot find package|package [\w.]+ does not exist|ClassNotFoundException|NoClassDefFoundError|missing go\.sum entry|no required module provides package|could not resolve dependencies/i;
const firstError = (out) =>
  (out.split('\n').find((l) => /error|not found|no matching|could not|denied|forbidden/i.test(l)) || out.split('\n')[0] || '')
    .trim()
    .slice(0, 200);

const clip = (s) => {
  const t = s.trim();
  return t.length <= 3000 ? t : `${t.slice(0, 1500)}\n...\n${t.slice(-1500)}`;
};
const sameOutput = (a, b) => {
  const norm = (s) => s.replace(/\r/g, '').split('\n').map((l) => l.trimEnd()).join('\n').trim();
  return norm(a) === norm(b);
};

/** The organiser's stdin -> expected stdout cases, against the built program (DSA events). */
async function ioTests(dir, cases, command) {
  if (!command) return { name: 'io tests', ok: null, skipped: 'no runnable program detected: set a run command for this event' };
  const results = [];
  for (const c of cases.slice(0, 200)) {
    const r = await sandbox(['bash', '-c', command], { dir, writable: false, stdin: c.input ?? '', timeMs: 10_000, jvm: true });
    const pass = r.ok && sameOutput(r.stdout, c.expected ?? '');
    results.push({ name: c.name, pass, error: r.killed || (r.ok ? undefined : tail(r.stderr) || `exit ${r.code}`), got: r.stdout.slice(0, 300) });
  }
  const failed = results.filter((r) => !r.pass);
  return {
    name: 'io tests (organiser cases)',
    ok: failed.length === 0,
    tests: { passed: results.length - failed.length, failed: failed.length },
    output: clip(
      failed.length
        ? failed.slice(0, 5).map((f) => `FAIL ${f.name || ''}: ${f.error || `got ${JSON.stringify(f.got)}`}`).join('\n')
        : `All ${results.length} cases passed`
    )
  };
}

async function project({ archive, ioTests: cases, runCommand }) {
  const buf = Buffer.from(String(archive || ''), 'base64');
  if (buf.length < 20) return { status: 400, body: { error: 'Empty archive' } };
  if (buf.length > 25 * 1024 * 1024) return { status: 413, body: { error: 'Archive too large' } };
  await acquire();
  const dir = await mkdtemp(path.join(os.tmpdir(), 'project-'));
  try {
    await chmod(dir, 0o777);
    await writeFile(path.join(dir, '.repo.tgz'), buf, { mode: 0o644 });
    // extracted as nobody inside the sandbox: a hostile archive can only write into /box
    const x = await sandbox(
      ['sh', '-c', 'tar -xzf .repo.tgz --strip-components=1 --no-same-owner --no-same-permissions 2>&1; rm -f .repo.tgz'],
      { dir, writable: true, timeMs: 60_000 }
    );
    if (!x.ok) return { status: 200, body: { steps: [{ name: 'extract', ok: false, output: clip(x.killed || x.stdout || x.stderr) }] } };

    const files = await listFiles(dir);
    const plan = await planSteps(dir, files);
    const steps = [];
    const failedFetch = new Set(); // folders whose dependencies did not install
    const failedBuild = new Set();
    let program = runCommand || undefined;
    for (const step of plan) {
      if (step.kind === 'meta') {
        program ??= step.produces;
        continue;
      }
      if (step.why) {
        if (step.kind === 'fetch') failedFetch.add(step.cwd);
        steps.push({ name: step.name, ok: null, skipped: step.why });
        continue;
      }
      // a failed dependency fetch does not stop the build/tests: many projects run fine without
      // (lint-only requirements, optional deps); only a failed BUILD stops later steps
      if (step.kind !== 'fetch' && step.kind !== 'build' && failedBuild.has(step.cwd)) {
        steps.push({ name: step.name, ok: null, skipped: 'build failed, not run' });
        continue;
      }
      if (step.writeSettings) await writeFile(path.join(dir, step.cwd, '_judge_settings.xml'), mavenSettings(), { mode: 0o644 });
      if (step.writeReqs) await writeFile(path.join(dir, step.cwd, '_judge_reqs.txt'), step.writeReqs.join('\n') + '\n', { mode: 0o644 });
      const cd = step.cwd ? `cd ${q([step.cwd])} && ` : '';
      const r = await sandbox(['bash', '-c', `${cd}${step.cmd} 2>&1`], {
        dir,
        writable: true,
        timeMs: step.kind === 'fetch' ? FETCH_MS : STEP_MS,
        jvm: step.jvm,
        net: !!step.net
      });
      const output = clip(`${r.stdout}${r.stderr}`);
      // Our limitations are never the student's failure, so these come out neutral (ok: null):
      // - the fetch itself failed (our safety rules: wheels only, registries only, no scripts)
      // - a later step failed only because a dependency we could not install is missing
      // - Maven needed a plugin lazily that could not be prefetched
      const fetchFailed = step.kind === 'fetch' && !r.ok;
      const missingDep =
        !r.ok && failedFetch.has(step.cwd) && MISSING_DEPENDENCY.test(output);
      const mavenOfflineGap = /maven/.test(step.name) && /offline|has not been downloaded|Cannot access .* in offline mode/i.test(output) && !r.ok;
      const neutral = fetchFailed
        ? `could not install dependencies under the judge's safety rules (registries only, prebuilt packages only, no install scripts): ${firstError(output)}. Not counted against the project.`
        : missingDep
          ? "failed only because a dependency the judge could not install is missing; not verified, not counted against the project"
          : mavenOfflineGap
            ? "a Maven plugin needed at this step could not be prefetched; not the project's fault"
            : undefined;
      if (fetchFailed) failedFetch.add(step.cwd);
      if (!r.ok && !neutral && step.kind === 'build') failedBuild.add(step.cwd);
      if (step.produces && r.ok && !step.cwd) program ??= step.produces === 'java' ? undefined : step.produces;
      steps.push({
        name: step.name,
        ok: neutral ? null : r.ok,
        ...(neutral ? { skipped: neutral } : {}),
        exitCode: r.code,
        error: r.killed || undefined,
        timeMs: r.timeMs,
        tests: step.kind === 'test' && !neutral ? testCounts(output) : undefined,
        note: step.note,
        output
      });
    }

    // Java program to run: the class with a main method, straight from the compiled output
    if (!program && plan.some((s) => s.produces === 'java') && !failedBuild.has('')) {
      for (const f of files.filter((f) => /\.java$/.test(f) && !isTest(f))) {
        const src = await readSmall(dir, f);
        if (/public\s+static\s+void\s+main\s*\(/.test(src)) {
          const pkg = src.match(/^\s*package\s+([\w.]+)\s*;/m)?.[1];
          const cls = f.split('/').pop().replace(/\.java$/, '');
          program = `java -Xmx256m -cp _classes ${pkg ? `${pkg}.${cls}` : cls}`;
          break;
        }
      }
    }
    if (Array.isArray(cases) && cases.length) {
      steps.push(
        failedBuild.size
          ? { name: 'io tests (organiser cases)', ok: null, skipped: 'build failed, not run' }
          : await ioTests(dir, cases, program)
      );
    }
    return { status: 200, body: { fileCount: files.length, steps } };
  } finally {
    await rm(dir, { recursive: true, force: true });
    release();
  }
}

const tail = (s) => s.trim().split('\n').slice(-8).join('\n').slice(-600);
// compilers report the root cause first
const head = (s) => s.trim().split('\n').slice(0, 12).join('\n').slice(0, 1200);

async function judge({ language, code, inputs, timeLimitMs }) {
  const lang = LANGS[language];
  if (!lang) return { status: 400, body: { error: `Unsupported language '${language}'.` } };
  if (typeof code !== 'string' || !code.trim() || code.length > 100_000) {
    return { status: 400, body: { error: 'code must be a non-empty string under 100KB.' } };
  }
  if (!Array.isArray(inputs) || inputs.length > 200 || inputs.some((i) => typeof i !== 'string')) {
    return { status: 400, body: { error: 'inputs must be an array of at most 200 strings.' } };
  }
  const perCase = Math.min(Math.max(Number(timeLimitMs) || 2000, 500), 10_000) * (lang.jvm ? 2 : 1);

  const dir = await mkdtemp(path.join(os.tmpdir(), 'judge-'));
  try {
    await chmod(dir, 0o777); // the sandbox user (nobody) compiles into it
    await writeFile(path.join(dir, lang.file), code, { mode: 0o644 });

    if (lang.compile) {
      const c = await sandbox(lang.compile, { dir, writable: true, timeMs: 30_000, jvm: lang.jvm });
      if (!c.ok) {
        return {
          status: 200,
          body: { compile: { ok: false, error: c.killed || head(c.stderr) || 'Compilation failed' }, results: [] }
        };
      }
    }

    const results = new Array(inputs.length);
    let next = 0;
    const worker = async () => {
      while (next < inputs.length) {
        const i = next++;
        const r = await sandbox(lang.run, { dir, writable: false, stdin: inputs[i], timeMs: perCase, jvm: lang.jvm });
        results[i] = r.ok
          ? { ok: true, output: r.stdout, timeMs: r.timeMs }
          : {
              ok: false,
              output: r.stdout.slice(0, 4000),
              error: r.killed || tail(r.stderr) || `Exited with code ${r.code ?? r.signal}`,
              timeMs: r.timeMs
            };
      }
    };
    await Promise.all(Array.from({ length: Math.min(WORKERS, inputs.length) }, worker));
    return { status: 200, body: { compile: { ok: true }, results } };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const server = http.createServer((req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (req.method === 'GET' && req.url === '/health') return send(200, { status: 'ok', languages: Object.keys(LANGS) });
  if (req.method === 'POST' && req.url === '/project') {
    // JSON: { archive: base64 .tar.gz, ioTests?: [{ name, input, expected }], runCommand? }
    let raw = '';
    req.on('data', (d) => {
      raw += d;
      if (raw.length > PROJECT_MAX) {
        send(413, { error: 'Request too large' });
        req.destroy();
      }
    });
    req.on('end', async () => {
      if (res.headersSent) return;
      try {
        const out = await project(JSON.parse(raw));
        send(out.status, out.body);
      } catch (e) {
        send(e instanceof SyntaxError ? 400 : 500, { error: String(e.message || e) });
      }
    });
    return;
  }
  if (req.method !== 'POST' || req.url !== '/run') return send(404, { error: 'Not found' });

  let raw = '';
  req.on('data', (d) => {
    raw += d;
    if (raw.length > MAX_BODY) {
      send(413, { error: 'Request too large' });
      req.destroy();
    }
  });
  req.on('end', async () => {
    if (res.headersSent) return;
    try {
      const out = await judge(JSON.parse(raw));
      send(out.status, out.body);
    } catch (e) {
      send(400, { error: e instanceof SyntaxError ? 'Invalid JSON' : String(e.message || e) });
    }
  });
});

// a whole-project run (fetch + build + tests) can take many minutes; Node's default 5-minute
// request timeout would reset the connection mid-run. Match the caller's 15-minute budget.
server.requestTimeout = 16 * 60_000;
server.headersTimeout = 60_000;

server.listen(PORT, () => console.log(`judge-runner listening on ${PORT} (${WORKERS} workers)`));
