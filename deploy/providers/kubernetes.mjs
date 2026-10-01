import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

// Shared by every platform that runs the stock k8s/ stack (GCP, Azure, local): skaffold builds
// and pushes the images and records their exact tags; a generated kustomize overlay pins those
// tags, so a rollback re-applies the recorded images with no rebuild.

export async function buildImages(ctx, { defaultRepo, push }) {
  const out = path.join(ctx.art, 'images.json');
  await ctx.run(
    'skaffold',
    [
      'build',
      '--file-output',
      out,
      ...(defaultRepo ? ['--default-repo', defaultRepo] : []),
      ...(push ? ['--push'] : [])
    ],
    { cwd: ctx.cwd }
  );
  return JSON.parse(readFileSync(out, 'utf8')).builds;
}

// "repo/name:tag@sha256:..." -> kustomize image override
function imageOverride({ imageName, tag }) {
  const [ref, digest] = tag.split('@');
  const cut = ref.lastIndexOf(':') > ref.lastIndexOf('/') ? ref.lastIndexOf(':') : -1;
  return {
    name: imageName,
    newName: cut >= 0 ? ref.slice(0, cut) : ref,
    ...(digest ? { digest } : cut >= 0 ? { newTag: ref.slice(cut + 1) } : {})
  };
}

// writes <worktree>/deploy-overlay and applies it to the environment's cluster
export async function applyStack(
  ctx,
  { builds, kubeContext, publicUrl, voiceUrl, tolerateSpot, externalS3 }
) {
  const dir = path.join(ctx.cwd, 'deploy-overlay');
  mkdirSync(dir, { recursive: true });
  if (!existsSync(path.join(ctx.cwd, 'k8s', 'secrets.yml'))) {
    throw new Error('k8s/secrets.yml is missing: the cluster needs its secrets (see README).');
  }
  const patches = [];
  if (externalS3) {
    // media in AWS S3 (the storage account): no MinIO, and the services talk to S3 itself.
    // Keys, region and bucket names come from media-secrets in k8s/secrets.yml.
    const drop = (apiVersion, kind, name) =>
      `$patch: delete
apiVersion: ${apiVersion}
kind: ${kind}
metadata:
  name: ${name}
`;
    const files = {
      'no-minio-data.yaml': drop('v1', 'PersistentVolumeClaim', 'minio-data'),
      'no-minio.yaml': drop('apps/v1', 'Deployment', 'minio'),
      'no-minio-svc.yaml': drop('v1', 'Service', 'minio'),
      'real-s3.yaml': `apiVersion: apps/v1
kind: Deployment
metadata:
  name: course-deployment
spec:
  template:
    spec:
      containers:
        - name: course-main
          env:
            - name: S3_ENDPOINT
              value: ''
            - name: S3_PUBLIC_ENDPOINT
              value: ''
`
    };
    for (const [file, body] of Object.entries(files)) {
      writeFileSync(path.join(dir, file), body);
      patches.push(`  - path: ${file}`);
    }
  } else if (publicUrl) {
    // presigned upload/download URLs are signed for the address browsers use
    writeFileSync(
      path.join(dir, 'public-url.yaml'),
      `apiVersion: apps/v1
kind: Deployment
metadata:
  name: course-deployment
spec:
  template:
    spec:
      containers:
        - name: course-main
          env:
            - name: S3_PUBLIC_ENDPOINT
              value: '${publicUrl}'
`
    );
    patches.push('  - path: public-url.yaml');
  }
  if (voiceUrl) {
    writeFileSync(
      path.join(dir, 'voice-url.yaml'),
      `apiVersion: v1
kind: Secret
metadata:
  name: livekit
stringData:
  LIVEKIT_URL: '${voiceUrl}'
`
    );
    patches.push('  - path: voice-url.yaml');
  }
  if (tolerateSpot) {
    // Azure spot pools are tainted: let every workload run there (the system pool is too small)
    writeFileSync(
      path.join(dir, 'spot.yaml'),
      `- op: add
  path: /spec/template/spec/tolerations
  value:
    - key: kubernetes.azure.com/scalesetpriority
      operator: Equal
      value: spot
      effect: NoSchedule
`
    );
    patches.push('  - path: spot.yaml\n    target:\n      kind: Deployment');
  }
  const images = builds.map(imageOverride);
  writeFileSync(
    path.join(dir, 'kustomization.yaml'),
    `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../k8s
images:
${images.map((i) => `  - ${JSON.stringify(i)}`).join('\n')}
${patches.length ? `patches:\n${patches.join('\n')}\n` : ''}`
  );
  await ctx.run('kubectl', ['apply', '-k', dir, '--context', kubeContext], { cwd: ctx.cwd });
  await ctx.run(
    'kubectl',
    ['rollout', 'status', 'deployment', '--context', kubeContext, '--timeout=600s'],
    { cwd: ctx.cwd }
  );
}

// ingress-nginx gives the stack's Ingress (class "nginx") a cloud load balancer
export async function ensureIngress(ctx, kubeContext) {
  await ctx.run('kubectl', [
    'apply',
    '--context',
    kubeContext,
    '-f',
    'https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.1/deploy/static/provider/cloud/deploy.yaml'
  ]);
  await ctx.run('kubectl', [
    'rollout',
    'status',
    'deployment/ingress-nginx-controller',
    '-n',
    'ingress-nginx',
    '--context',
    kubeContext,
    '--timeout=600s'
  ]);
}

// the load balancer's public address, once the cloud has assigned it
export async function ingressAddress(ctx, kubeContext) {
  for (let i = 0; i < 60; i++) {
    const out = await ctx.run(
      'kubectl',
      [
        'get',
        'svc',
        'ingress-nginx-controller',
        '-n',
        'ingress-nginx',
        '--context',
        kubeContext,
        '-o',
        'jsonpath={.status.loadBalancer.ingress[0].ip}{.status.loadBalancer.ingress[0].hostname}'
      ],
      { quiet: true }
    );
    if (out.trim()) return out.trim();
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error('The load balancer got no public address within 10 minutes.');
}

// deploy + rollback for the k8s platforms: rollback reuses the recorded images
export function kubernetesDeploy({ registry, push, kubeContext, tolerateSpot = () => false }) {
  return async (ctx) => {
    const context = kubeContext(ctx);
    ctx.step('images');
    const builds =
      ctx.rollbackOf?.images || (await buildImages(ctx, { defaultRepo: registry(ctx), push }));
    let publicUrl = ctx.cfg.publicUrl;
    if (!publicUrl && ctx.provider !== 'local') {
      publicUrl = `http://${await ingressAddress(ctx, context)}`;
    }
    ctx.step('apply');
    await applyStack(ctx, {
      builds,
      kubeContext: context,
      publicUrl: publicUrl || 'http://localhost:3000',
      voiceUrl: ctx.cfg.voiceUrl,
      tolerateSpot: tolerateSpot(ctx),
      externalS3: ctx.cfg.mediaInS3 === 'yes'
    });
    return {
      kubeContext: context,
      images: builds,
      outputs: { appUrl: publicUrl || 'http://localhost:3000' }
    };
  };
}
