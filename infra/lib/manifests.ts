import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';

// The same k8s/ manifests the local cluster uses, adapted for EKS at synth time. Nothing here is
// written back to k8s/: kind/skaffold keep working unchanged.

// EKS Production: data stores are managed services, voice + judge run on EC2, ALB is the ingress
export const EKS_SKIP = new Set([
  'secrets.yml', // Secrets Manager + External Secrets
  'minio.yml', // S3
  'redis-deployment.yml', // ElastiCache
  'redis-service.yml',
  'livekit-deployment.yml', // EC2
  'judge-deployment.yml', // EC2 (judge + registry proxy)
  'ingress.yml' // ALB ingress below
]);

// budget plans (EKS Starter, Lite): Redis, judge and voice stay in the cluster; S3 for media
// and Caddy (not an ingress controller) in front
export const IN_CLUSTER_SKIP = new Set(['secrets.yml', 'minio.yml', 'ingress.yml']);

// env vars that only make sense against the local MinIO
const DROP_ENV = new Set(['S3_ENDPOINT', 'S3_PUBLIC_ENDPOINT']);

export type Manifest = Record<string, any>;

export function loadManifests(repoRoot: string, skip: Set<string> = EKS_SKIP): Manifest[] {
  const dir = path.join(repoRoot, 'k8s');
  const kustomization = yaml.load(
    fs.readFileSync(path.join(dir, 'kustomization.yaml'), 'utf8')
  ) as { resources: string[] };
  return kustomization.resources
    .filter((file) => !skip.has(file))
    .flatMap((file) =>
      (yaml.loadAll(fs.readFileSync(path.join(dir, file), 'utf8')) as Manifest[]).filter(Boolean)
    );
}

// every (secret name -> keys) the kept workloads read through secretKeyRef
export function secretRefs(manifests: Manifest[]): Map<string, Set<string>> {
  const refs = new Map<string, Set<string>>();
  for (const m of manifests) {
    for (const c of m.spec?.template?.spec?.containers || []) {
      for (const e of c.env || []) {
        const ref = e.valueFrom?.secretKeyRef;
        if (!ref) continue;
        if (!refs.has(ref.name)) refs.set(ref.name, new Set());
        refs.get(ref.name)!.add(ref.key);
      }
    }
  }
  return refs;
}

export function adaptForEks(
  manifests: Manifest[],
  opts: {
    images: Record<string, string>;
    // workloads that read/write S3 through an IRSA service account
    storageWorkloads: string[];
    storageServiceAccount: string;
    // one node: a second copy of a service adds no availability, only memory
    singleReplica?: boolean;
  }
): Manifest[] {
  return manifests.map((original) => {
    const m = structuredClone(original);
    const pod = m.kind === 'Deployment' ? m.spec?.template?.spec : undefined;
    if (!pod) return m;
    if (opts.singleReplica) {
      m.spec.replicas = 1;
      // no room for a second copy on a small node: stop the old pod, then start the new one
      m.spec.strategy = {
        type: 'RollingUpdate',
        rollingUpdate: { maxSurge: 0, maxUnavailable: 1 }
      };
    }
    for (const c of pod.containers || []) {
      if (opts.images[c.image]) {
        c.image = opts.images[c.image];
        c.imagePullPolicy = 'IfNotPresent';
      }
      if (c.env) c.env = c.env.filter((e: { name: string }) => !DROP_ENV.has(e.name));
    }
    if (opts.storageWorkloads.includes(m.metadata?.name)) {
      pod.serviceAccountName = opts.storageServiceAccount;
    }
    return m;
  });
}
