import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';

// live output of running jobs, for the UI's log stream (job id -> lines)
export const bus = new EventEmitter();
bus.setMaxListeners(100);

const win = process.platform === 'win32';
// cloud CLIs are .cmd shims on Windows; quote for cmd.exe when a shell is needed
const quote = (a) => (/[\s"&|<>^]/.test(a) ? `"${String(a).replace(/"/g, '\\"')}"` : a);

// Runs a command, appending everything it prints to the job's log (and the live stream).
// Resolves with stdout; rejects on a non-zero exit. `quiet` keeps output out of the log
// (used for identity probes, whose output the caller parses).
export function run(cmd, args = [], { cwd, env, log, id, quiet = false, input } = {}) {
  return new Promise((resolve, reject) => {
    const line = (text) => {
      if (!log || quiet) return;
      appendFileSync(log, text);
      if (id) bus.emit(id, text);
    };
    line(`\n$ ${[cmd, ...args].join(' ')}\n`);
    const child = spawn(win ? [cmd, ...args].map(quote).join(' ') : cmd, win ? [] : args, {
      cwd,
      env: { ...process.env, ...env },
      shell: win,
      windowsHide: true
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      out += d;
      line(String(d));
    });
    child.stderr.on('data', (d) => {
      err += d;
      line(String(d));
    });
    if (input !== undefined) child.stdin.end(input);
    child.on('error', (e) => reject(new Error(`${cmd}: ${e.message}`)));
    child.on('close', (code) =>
      code === 0
        ? resolve(out)
        : reject(new Error(`${cmd} exited with ${code}${quiet ? `: ${(err || out).trim().slice(-400)}` : ''}`))
    );
  });
}

// true when a CLI is installed and on PATH
export async function has(cmd) {
  try {
    await run(win ? 'where' : 'which', [cmd], { quiet: true });
    return true;
  } catch {
    return false;
  }
}
