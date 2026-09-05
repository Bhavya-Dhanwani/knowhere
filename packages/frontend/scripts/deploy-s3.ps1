param(
    [Parameter(Mandatory=$false)]
    [string]$BucketName = $env:S3_BUCKET,

    [Parameter(Mandatory=$false)]
    [string]$DistributionId = $env:CLOUDFRONT_DIST_ID
)

if (-not $BucketName) {
    Write-Error "Bucket name is required. Provide -BucketName <bucket> or set `$env:S3_BUCKET"
    exit 1
}

Write-Host "==> [1/4] Building production frontend bundle..." -ForegroundColor Cyan
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend build failed."
    exit $LASTEXITCODE
}

Write-Host "==> [2/4] Syncing immutable static assets to s3://$BucketName/assets..." -ForegroundColor Cyan
aws s3 sync dist/assets "s3://$BucketName/assets" `
    --delete `
    --cache-control "public, max-age=31536000, immutable"

if ($LASTEXITCODE -ne 0) {
    Write-Error "S3 sync for assets failed."
    exit $LASTEXITCODE
}

Write-Host "==> [3/4] Syncing index.html and root files with no-cache revalidation..." -ForegroundColor Cyan
aws s3 sync dist "s3://$BucketName" `
    --exclude "assets/*" `
    --delete `
    --cache-control "public, max-age=0, must-revalidate"

if ($LASTEXITCODE -ne 0) {
    Write-Error "S3 sync for root files failed."
    exit $LASTEXITCODE
}

if ($DistributionId) {
    Write-Host "==> [4/4] Creating CloudFront invalidation for distribution $DistributionId..." -ForegroundColor Cyan
    aws cloudfront create-invalidation `
        --distribution-id $DistributionId `
        --paths "/*"
    Write-Host "CloudFront invalidation submitted successfully!" -ForegroundColor Green
} else {
    Write-Host "==> [4/4] Skipped CloudFront invalidation (No distribution ID provided)." -ForegroundColor Yellow
}

Write-Host "Deployment completed successfully to S3: $BucketName!" -ForegroundColor Green
