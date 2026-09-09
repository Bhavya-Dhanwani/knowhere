export interface SandboxResourceLimits {
  cpu: string;
  memory: string;
  ephemeralStorage: string;
  activeDeadlineSeconds: number;
}

export interface EvaluationJobInput {
  evaluationId: string;
  repositoryUrl: string;
  commitSha: string;
  image: string;
  command: string[];
  allowNetworkTo?: Array<{ cidr: string; port: number }>;
  limits?: Partial<SandboxResourceLimits>;
}

const dnsLabel = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 45);

/**
 * Produces the Kubernetes resources used to execute participant repositories. The API service only
 * creates declarative jobs; participant commands are never executed in the API container.
 */
export class KubernetesSandboxManifestGenerator {
  public static generate(input: EvaluationJobInput): object[] {
    const name = `evaluation-${dnsLabel(input.evaluationId)}`;
    const limits: SandboxResourceLimits = {
      cpu: input.limits?.cpu || '1',
      memory: input.limits?.memory || '1Gi',
      ephemeralStorage: input.limits?.ephemeralStorage || '4Gi',
      activeDeadlineSeconds: input.limits?.activeDeadlineSeconds || 900
    };

    const networkEgress = (input.allowNetworkTo || []).map((destination) => ({
      to: [{ ipBlock: { cidr: destination.cidr } }],
      ports: [{ protocol: 'TCP', port: destination.port }]
    }));

    return [
      {
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: { name, labels: { 'app.kubernetes.io/managed-by': 'knowhere-evaluator' } }
      },
      {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'NetworkPolicy',
        metadata: { name: 'deny-all-except-allowlist', namespace: name },
        spec: {
          podSelector: {},
          policyTypes: ['Ingress', 'Egress'],
          ingress: [],
          egress: networkEgress
        }
      },
      {
        apiVersion: 'batch/v1',
        kind: 'Job',
        metadata: { name: 'runner', namespace: name, labels: { evaluationId: input.evaluationId } },
        spec: {
          backoffLimit: 0,
          activeDeadlineSeconds: limits.activeDeadlineSeconds,
          ttlSecondsAfterFinished: 600,
          template: {
            metadata: { labels: { evaluationId: input.evaluationId } },
            spec: {
              runtimeClassName: process.env.EVALUATION_RUNTIME_CLASS || 'gvisor',
              automountServiceAccountToken: false,
              restartPolicy: 'Never',
              securityContext: { runAsNonRoot: true, seccompProfile: { type: 'RuntimeDefault' } },
              containers: [
                {
                  name: 'evaluator',
                  image: input.image,
                  imagePullPolicy: 'IfNotPresent',
                  command: input.command,
                  env: [
                    { name: 'REPOSITORY_URL', value: input.repositoryUrl },
                    { name: 'COMMIT_SHA', value: input.commitSha }
                  ],
                  resources: {
                    requests: { cpu: '100m', memory: '128Mi', 'ephemeral-storage': '512Mi' },
                    limits: {
                      cpu: limits.cpu,
                      memory: limits.memory,
                      'ephemeral-storage': limits.ephemeralStorage
                    }
                  },
                  securityContext: {
                    allowPrivilegeEscalation: false,
                    readOnlyRootFilesystem: true,
                    runAsNonRoot: true,
                    runAsUser: 65532,
                    capabilities: { drop: ['ALL'] }
                  },
                  volumeMounts: [
                    { name: 'workspace', mountPath: '/workspace' },
                    { name: 'tmp', mountPath: '/tmp' }
                  ]
                }
              ],
              volumes: [
                { name: 'workspace', emptyDir: { sizeLimit: limits.ephemeralStorage } },
                { name: 'tmp', emptyDir: { sizeLimit: '512Mi' } }
              ]
            }
          }
        }
      }
    ];
  }
}

/** Compatibility alias for callers from the previous implementation. */
export const Tier2K8sManifestGenerator = KubernetesSandboxManifestGenerator;
