// Access tokens are RS256: auth-service alone holds the private key and signs; every other
// service only verifies with the public key, so no service can mint a user's token.
// Calls between services use a separate, scoped service token (see serviceToken).
//
// Keys come from env vars. Outside production, missing ones fall back to dev keys that are
// generated once per checkout into `.dev-keys.json` at the repo root (gitignored), so no key
// material ever lives in source. With NODE_ENV=production there is no fallback: a deployment
// without real keys fails at startup.
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, linkSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import jwt, { SignOptions } from 'jsonwebtoken';

interface DevKeys {
  accessPrivateKey: string;
  accessPublicKey: string;
  serviceTokenSecret: string;
  mediaSigningSecret: string;
}

// the workspace root, so every service (each started from its own package dir) shares one file
function devKeysFile() {
  let dir = process.cwd();
  while (!existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) return path.join(process.cwd(), '.dev-keys.json');
    dir = parent;
  }
  return path.join(dir, '.dev-keys.json');
}

let devKeys: DevKeys | undefined;
function loadDevKeys(): DevKeys {
  if (devKeys) return devKeys;
  const file = devKeysFile();
  if (!existsSync(file)) {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    const fresh: DevKeys = {
      accessPrivateKey: privateKey,
      accessPublicKey: publicKey,
      serviceTokenSecret: randomBytes(32).toString('hex'),
      mediaSigningSecret: randomBytes(32).toString('hex')
    };
    // services boot in parallel: write aside, then hard-link into place atomically.
    // Whoever links first wins; everyone else reads the winner's file.
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmp, JSON.stringify(fresh), { mode: 0o600 });
    try {
      linkSync(tmp, file);
    } catch {
      // another process created it first
    } finally {
      unlinkSync(tmp);
    }
  }
  devKeys = JSON.parse(readFileSync(file, 'utf8')) as DevKeys;
  return devKeys;
}

// PEMs often arrive through env vars with escaped newlines
const pem = (v: string) => v.replace(/\\n/g, '\n');

function fromEnv(name: string, dev: keyof DevKeys, transform: (v: string) => string = (v) => v) {
  const value = process.env[name];
  if (value) return transform(value);
  if (process.env.NODE_ENV === 'production') throw new Error(`${name} must be set in production`);
  return loadDevKeys()[dev];
}

export const accessPublicKey = () => fromEnv('ACCESS_TOKEN_PUBLIC_KEY', 'accessPublicKey', pem);
export const accessPrivateKey = () => fromEnv('ACCESS_TOKEN_PRIVATE_KEY', 'accessPrivateKey', pem);
export const serviceTokenSecret = () => fromEnv('SERVICE_TOKEN_SECRET', 'serviceTokenSecret');
export const mediaSigningSecret = () => fromEnv('MEDIA_SIGNING_SECRET', 'mediaSigningSecret');

// call at boot so a misconfigured deployment fails immediately, not on the first request
export function assertKeysConfigured(role: 'issuer' | 'verifier') {
  accessPublicKey();
  if (role === 'issuer') accessPrivateKey();
}

export function signAccessToken(payload: object, expiresIn: SignOptions['expiresIn'] = '15m') {
  return jwt.sign(payload, accessPrivateKey(), { algorithm: 'RS256', expiresIn });
}

// only RS256 is accepted, so an HS256 token signed with the public key as a secret is rejected
export function verifyAccessToken(token: string) {
  return jwt.verify(token, accessPublicKey(), { algorithms: ['RS256'] }) as Record<string, unknown>;
}
