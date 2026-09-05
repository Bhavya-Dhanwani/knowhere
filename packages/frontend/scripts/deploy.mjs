import { execSync } from 'child_process';
import { existsSync } from 'fs';

const bucket = process.env.S3_BUCKET || process.argv[2];
const distributionId = process.env.CLOUDFRONT_DIST_ID || process.argv[3];

if (!bucket) {
  console.error('Error: S3 bucket name is required.');
  console.error('Usage: node scripts/deploy.mjs <bucket-name> [cloudfront-dist-id]');
  console.error('Or set S3_BUCKET and CLOUDFRONT_DIST_ID environment variables.');
  process.exit(1);
}

function run(cmd) {
  console.log(`\x1b[36m==> Executing: ${cmd}\x1b[0m`);
  execSync(cmd, { stdio: 'inherit' });
}

try {
  console.log('\x1b[34m[1/4] Building production frontend...\x1b[0m');
  run('pnpm build');

  if (!existsSync('dist')) {
    throw new Error('dist directory was not created. Build failed.');
  }

  console.log(`\x1b[34m[2/4] Syncing immutable static assets to s3://${bucket}/assets/ ...\x1b[0m`);
  run(`aws s3 sync dist/assets s3://${bucket}/assets --delete --cache-control "public, max-age=31536000, immutable"`);

  console.log(`\x1b[34m[3/4] Syncing index.html and root files to s3://${bucket}/ ...\x1b[0m`);
  run(`aws s3 sync dist s3://${bucket} --exclude "assets/*" --delete --cache-control "public, max-age=0, must-revalidate"`);

  if (distributionId) {
    console.log(`\x1b[34m[4/4] Creating CloudFront cache invalidation for distribution ${distributionId}...\x1b[0m`);
    run(`aws cloudfront create-invalidation --distribution-id ${distributionId} --paths "/*"`);
  } else {
    console.log('\x1b[33m[4/4] Skipping CloudFront cache invalidation (No distribution ID provided).\x1b[0m');
  }

  console.log(`\x1b[32m✔ Successfully deployed to AWS S3 & CloudFront (Bucket: ${bucket})\x1b[0m`);
} catch (err) {
  console.error('\x1b[31mDeployment failed:\x1b[0m', err.message);
  process.exit(1);
}
