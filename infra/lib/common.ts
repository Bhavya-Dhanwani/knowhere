import { RemovalPolicy, SecretValue, Stack } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { mediaBucketName } from './media-stack';
import { Manifest } from './manifests';

// Pieces every AWS plan shares: images, media buckets, secrets, and the Caddy front end used by
// the plans without a load balancer.

export interface CommonProps {
  domainName?: string;
  arch: 'arm64' | 'amd64';
  mediaAccount?: string;
  mediaRegion?: string;
}

// every image the app is made of (same list as skaffold.yaml)
export const SERVICES: Record<string, string> = {
  'auth-service': 'packages/auth-service/Dockerfile',
  'user-service': 'packages/user-service/Dockerfile',
  'course-service': 'packages/course-service/Dockerfile',
  'media-service': 'packages/media-service/Dockerfile',
  'mcq-service': 'packages/mcq-service/Dockerfile',
  'coding-service': 'packages/coding-service/Dockerfile',
  'project-review-service': 'packages/project-review-service/Dockerfile',
  'chat-service': 'packages/chat-service/Dockerfile',
  frontend: 'packages/frontend/Dockerfile',
  'judge-runner': 'packages/judge-runner/Dockerfile'
};

// secrets whose values the stack knows (everything else is yours, in Secrets Manager)
export const STACK_MANAGED_SECRETS = new Set(['media-secrets', 'redis', 'livekit']);

// built for the machine running `cdk deploy` and pushed to ECR during deploy
export function buildImages(scope: Stack, repoRoot: string, arch: CommonProps['arch']) {
  const platform = arch === 'arm64' ? Platform.LINUX_ARM64 : Platform.LINUX_AMD64;
  const images: Record<string, DockerImageAsset> = {};
  for (const [name, file] of Object.entries(SERVICES)) {
    images[name] = new DockerImageAsset(scope, `Image-${name}`, {
      directory: repoRoot,
      file,
      platform,
      // .dockerignore keeps .env files, k8s/secrets.yml and infra/ out of the context
      exclude: ['infra', '**/node_modules', '.git', 'graphify-out', 'ui-e2e-shots']
    });
  }
  return images;
}

// media buckets: created here, or (mediaAccount set) the KnowhereMedia stack's, by name
export function mediaStorage(scope: Stack, props: CommonProps) {
  const appOrigin = props.domainName ? `https://${props.domainName}` : '*';
  const created = (id: string) =>
    new s3.Bucket(scope, id, {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      // browsers PUT uploads and fetch HLS segments with presigned URLs, cross-origin
      cors: [
        {
          allowedOrigins: [appOrigin],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.HEAD],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag', 'Content-Length', 'Content-Range'],
          maxAge: 3600
        }
      ]
    });
  const crossAccount = Boolean(props.mediaAccount && props.mediaAccount !== scope.account);
  const mediaRegion = props.mediaRegion || scope.region;
  const imported = (id: string, kind: 'raw' | 'transcoded') =>
    s3.Bucket.fromBucketAttributes(scope, id, {
      bucketName: mediaBucketName(kind, props.mediaAccount!, mediaRegion),
      account: props.mediaAccount,
      region: mediaRegion
    });
  return {
    crossAccount,
    mediaRegion,
    raw: crossAccount ? imported('RawMedia', 'raw') : created('RawMedia'),
    transcoded: crossAccount
      ? imported('TranscodedMedia', 'transcoded')
      : created('TranscodedMedia')
  };
}

// knowhere/<name> in Secrets Manager for every secret the workloads read (you fill them with
// infra/scripts/push-secrets.mjs), plus generated LiveKit keys
export function appSecrets(scope: Stack, refs: Map<string, Set<string>>) {
  const names = [...refs.keys()].filter((n) => !STACK_MANAGED_SECRETS.has(n));
  const secrets = names.map(
    (name) =>
      new secretsmanager.Secret(scope, `Secret-${name}`, {
        secretName: `knowhere/${name}`,
        description: `Kubernetes secret "${name}": JSON with ${[...refs.get(name)!].join(', ')}`,
        // placeholder only; set the real values once with push-secrets (CDK never overwrites them)
        secretStringValue: SecretValue.unsafePlainText('{}')
      })
  );
  const livekit = new secretsmanager.Secret(scope, 'LivekitSecret', {
    secretName: 'knowhere/livekit',
    generateSecretString: {
      secretStringTemplate: JSON.stringify({ LIVEKIT_API_KEY: 'knowhere' }),
      generateStringKey: 'LIVEKIT_API_SECRET',
      excludePunctuation: true,
      passwordLength: 48
    }
  });
  return { names, secrets, livekit };
}

// Caddy on the node's own network: HTTPS for the app (and wss:// for voice) without paying for a
// load balancer. Certificates come from Let's Encrypt and are kept on the node.
export function caddyManifests(domain?: string): Manifest[] {
  const site = domain
    ? `${domain} {\n  reverse_proxy frontend-service.default.svc.cluster.local:80\n}\nvoice.${domain} {\n  reverse_proxy 127.0.0.1:7880\n}\n`
    : ':80 {\n  reverse_proxy frontend-service.default.svc.cluster.local:80\n}\n';
  return [
    {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: { name: 'caddy', namespace: 'default' },
      data: { Caddyfile: site }
    },
    {
      apiVersion: 'apps/v1',
      kind: 'DaemonSet',
      metadata: { name: 'caddy', namespace: 'default', labels: { app: 'caddy' } },
      spec: {
        selector: { matchLabels: { app: 'caddy' } },
        template: {
          metadata: { labels: { app: 'caddy' } },
          spec: {
            hostNetwork: true,
            dnsPolicy: 'ClusterFirstWithHostNet',
            containers: [
              {
                name: 'caddy',
                image: 'caddy:2',
                ports: [{ containerPort: 80 }, { containerPort: 443 }],
                volumeMounts: [
                  { name: 'config', mountPath: '/etc/caddy' },
                  { name: 'data', mountPath: '/data' }
                ],
                resources: { requests: { cpu: '50m', memory: '64Mi' }, limits: { memory: '256Mi' } }
              }
            ],
            volumes: [
              { name: 'config', configMap: { name: 'caddy' } },
              { name: 'data', hostPath: { path: '/var/lib/caddy', type: 'DirectoryOrCreate' } }
            ]
          }
        }
      }
    }
  ];
}
