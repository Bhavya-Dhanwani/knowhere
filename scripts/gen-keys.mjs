// Prints fresh production credentials: `pnpm keys`.
// Paste them into k8s/secrets.yml (secret `jwt-keys`) or your env; never commit the output.
import { generateKeyPairSync, randomBytes } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
const indent = (pem) => pem.trim().split('\n').map((l) => `    ${l}`).join('\n');

console.log(`  # auth-service only
  ACCESS_TOKEN_PRIVATE_KEY: |
${indent(privateKey)}
  # every service
  ACCESS_TOKEN_PUBLIC_KEY: |
${indent(publicKey)}
  SERVICE_TOKEN_SECRET: '${randomBytes(32).toString('hex')}'
  MEDIA_SIGNING_SECRET: '${randomBytes(32).toString('hex')}'
  LIVEKIT_API_SECRET: '${randomBytes(32).toString('hex')}'`);
