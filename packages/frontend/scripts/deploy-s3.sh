#!/usr/bin/env bash
set -e

BUCKET_NAME="${1:-$S3_BUCKET}"
DISTRIBUTION_ID="${2:-$CLOUDFRONT_DIST_ID}"

if [ -z "$BUCKET_NAME" ]; then
  echo "Error: S3 bucket name is required. Usage: ./deploy-s3.sh <bucket-name> [cloudfront-dist-id]"
  exit 1
fi

echo "==> [1/4] Building production frontend bundle..."
pnpm build

echo "==> [2/4] Syncing immutable static assets to s3://$BUCKET_NAME/assets..."
aws s3 sync dist/assets "s3://$BUCKET_NAME/assets" \
  --delete \
  --cache-control "public, max-age=31536000, immutable"

echo "==> [3/4] Syncing index.html and root files with no-cache revalidation..."
aws s3 sync dist "s3://$BUCKET_NAME" \
  --exclude "assets/*" \
  --delete \
  --cache-control "public, max-age=0, must-revalidate"

if [ -n "$DISTRIBUTION_ID" ]; then
  echo "==> [4/4] Creating CloudFront invalidation for distribution $DISTRIBUTION_ID..."
  aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*"
  echo "CloudFront invalidation submitted successfully!"
else
  echo "==> [4/4] Skipped CloudFront invalidation (No distribution ID provided)."
fi

echo "Deployment completed successfully to S3: $BUCKET_NAME!"
