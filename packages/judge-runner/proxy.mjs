// Registry proxy: the ONLY way the judge's dependency-fetch phase reaches the internet.
// An HTTPS CONNECT proxy that tunnels to an allowlist of official package registries on port 443
// and nothing else; a name that resolves to a private address is refused (no DNS rebinding into
// the cluster). Runs from the judge-runner image with `node proxy.mjs`, as its own pod.
import http from 'node:http';
import net from 'node:net';
import { lookup } from 'node:dns/promises';

// own variable: the image's PORT belongs to the judge server
const PORT = Number(process.env.PROXY_PORT || 3128);
const ALLOW = new Set(
  (
    process.env.REGISTRY_ALLOWLIST ||
    [
      'registry.npmjs.org', // npm
      'pypi.org',
      'files.pythonhosted.org', // pip
      'repo.maven.apache.org',
      'repo1.maven.org', // Maven Central
      'proxy.golang.org',
      'sum.golang.org' // Go modules + checksum DB
    ].join(',')
  )
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
);

export const isPrivate = (ip) => {
  if (net.isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return isPrivate(v.slice(7));
    return v === '::1' || v === '::' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
  }
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  );
};

const server = http.createServer((req, res) => {
  // plain-HTTP proxying is never needed: registries are HTTPS-only
  if (req.url === '/health') return res.end('ok');
  res.writeHead(405).end('CONNECT only');
});

server.on('connect', async (req, client, head) => {
  const [host, portStr] = String(req.url).split(':');
  const port = Number(portStr);
  const deny = (why) => {
    console.log(`DENY ${req.url} (${why})`);
    client.end(`HTTP/1.1 403 Forbidden\r\n\r\n`);
  };
  if (port !== 443 || !ALLOW.has(host.toLowerCase())) return deny('not an allowlisted registry');
  let address;
  try {
    ({ address } = await lookup(host));
  } catch {
    return deny('DNS failure');
  }
  if (isPrivate(address)) return deny(`resolves to private ${address}`);
  // connect to the address we vetted, not the name (no second lookup to race)
  const upstream = net.connect(port, address, () => {
    client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head?.length) upstream.write(head);
    upstream.pipe(client);
    client.pipe(upstream);
  });
  const close = () => {
    upstream.destroy();
    client.destroy();
  };
  upstream.on('error', close);
  client.on('error', close);
  upstream.setTimeout(120_000, close);
  console.log(`ALLOW ${host}:${port}`);
});

server.listen(PORT, () => console.log(`registry proxy on ${PORT}; allowlist: ${[...ALLOW].join(', ')}`));
