// Self-check for a running judge-runner: `node check.mjs [url]` (default http://localhost:5010).
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
assert.equal((await (await fetch(`${url}/health`)).json()).status, 'ok', 'runner survives the abuse');
console.log('judge-runner: all checks passed');
