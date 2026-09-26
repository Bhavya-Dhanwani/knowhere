// Judge runner: compiles and runs learner programs (stdin -> stdout) for Python, C++ and Java.
// Every compile and every test case runs in its own bubblewrap sandbox: fresh user, pid, net,
// ipc, uts and mount namespaces (so no network), a read-only system, all capabilities dropped,
// rlimits on memory/files/processes and a hard wall-clock kill. Nothing survives between runs.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.PORT || 5010);
const MAX_BODY = 8 * 1024 * 1024;
const OUTPUT_CAP = 1024 * 1024;
const WORKERS = Math.max(1, Number(process.env.JUDGE_CONCURRENCY) || os.cpus().length);

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

// one sandboxed process; resolves with its output, never throws
function sandbox(argv, { dir, writable, stdin = '', timeMs, jvm }) {
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
    '--unshare-all', '--unshare-user', '--uid', '65534', '--gid', '65534',
    '--die-with-parent', '--new-session', '--cap-drop', 'ALL',
    '--ro-bind', '/usr', '/usr', '--ro-bind', '/etc', '/etc',
    '--symlink', 'usr/bin', '/bin', '--symlink', 'usr/lib', '/lib', '--symlink', 'usr/sbin', '/sbin',
    ...(process.arch === 'x64' ? ['--symlink', 'usr/lib64', '/lib64'] : []),
    '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp',
    writable ? '--bind' : '--ro-bind', dir, '/box', '--chdir', '/box',
    '--clearenv', '--setenv', 'PATH', '/usr/local/bin:/usr/bin:/bin',
    '--setenv', 'HOME', '/tmp', '--setenv', 'LANG', 'C.UTF-8',
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

server.listen(PORT, () => console.log(`judge-runner listening on ${PORT} (${WORKERS} workers)`));
