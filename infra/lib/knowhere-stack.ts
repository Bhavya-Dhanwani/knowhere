import * as path from 'node:path';
import { CfnOutput, CfnResource, Fn, Size, Stack, StackProps, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { KubectlV35Layer } from '@aws-cdk/lambda-layer-kubectl-v35';
import { adaptForEks, EKS_SKIP, IN_CLUSTER_SKIP, loadManifests, secretRefs } from './manifests';
import { judgeBootScript, livekitBootScript } from './hosts';
import { storageRoleArnPattern } from './media-stack';
import { appSecrets, buildImages, caddyManifests, CommonProps, mediaStorage } from './common';

// Two EKS plans share this stack:
//   standard (EKS Production): private nodes behind NAT, ALB + ACM, ElastiCache, judge and voice
//                              on their own EC2 servers
//   starter  (EKS Starter):    one (spot) node in a public subnet on a static IP; Redis, judge and
//                              voice in the cluster; Caddy for HTTPS instead of a load balancer

export interface KnowhereProps extends StackProps, CommonProps {
  plan: 'standard' | 'starter';
  // app URL, e.g. lms.example.com (voice is served on voice.<domainName>); without it plain HTTP
  // on the public address and voice over ws://<ip>:7880 (testing only)
  hostedZoneId?: string;
  hostedZoneName?: string;
  // IAM role/user ARN that gets cluster-admin in EKS (kubectl access)
  adminPrincipalArn?: string;
  nodeInstanceType: string;
  nodeCount: number;
  spot: boolean;
  judgeInstanceType: string;
  livekitInstanceType: string;
}

const STORAGE_SA = 'media-storage';

export class KnowhereStack extends Stack {
  constructor(scope: Construct, id: string, props: KnowhereProps) {
    super(scope, id, props);
    const repoRoot = path.resolve(__dirname, '../..');
    const arm = props.arch === 'arm64';
    const starter = props.plan === 'starter';
    const voiceDomain = props.domainName ? `voice.${props.domainName}` : undefined;
    const zone =
      props.domainName && props.hostedZoneId && props.hostedZoneName
        ? route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
            hostedZoneId: props.hostedZoneId,
            zoneName: props.hostedZoneName
          })
        : undefined;
    Tags.of(this).add('app', 'knowhere');
    Tags.of(this).add('plan', props.plan);

    /* ------------------------------------------------------------------ network */
    // one fixed egress IP either way (add it to the MongoDB Atlas IP access list): the NAT
    // gateway's (standard) or the node's own static IP (starter, which has no NAT)
    const egressIp = new ec2.CfnEIP(this, starter ? 'NodeIp' : 'NatIp', { domain: 'vpc' });
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: starter ? 0 : 1,
      ...(starter
        ? {
            subnetConfiguration: [
              { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 }
            ]
          }
        : {
            natGatewayProvider: ec2.NatProvider.gateway({
              eipAllocationIds: [egressIp.attrAllocationId]
            }),
            subnetConfiguration: [
              { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
              { name: 'private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 20 }
            ]
          })
    });
    const nodeSubnets = {
      subnetType: starter ? ec2.SubnetType.PUBLIC : ec2.SubnetType.PRIVATE_WITH_EGRESS
    };
    if (!starter) {
      // the load balancer controller finds subnets by these tags
      vpc.publicSubnets.forEach((s) => Tags.of(s).add('kubernetes.io/role/elb', '1'));
      vpc.privateSubnets.forEach((s) => Tags.of(s).add('kubernetes.io/role/internal-elb', '1'));
    }

    const images = buildImages(this, repoRoot, props.arch);
    const media = mediaStorage(this, props);

    /* ------------------------------------------------------------------ EKS */
    const cluster = new eks.Cluster(this, 'Cluster', {
      clusterName: 'knowhere',
      version: eks.KubernetesVersion.V1_35,
      kubectlLayer: new KubectlV35Layer(this, 'Kubectl'),
      // new AWS accounts cap Lambda memory at 512 MB (CDK's default for this handler is 1 GB)
      kubectlMemory: Size.mebibytes(512),
      vpc,
      vpcSubnets: [nodeSubnets],
      defaultCapacity: 0,
      authenticationMode: eks.AuthenticationMode.API_AND_CONFIG_MAP,
      ...(starter ? {} : { albController: { version: eks.AlbControllerVersion.V2_17_1 } })
    });
    // enforce NetworkPolicies (the judge may only reach its registry proxy)
    new eks.CfnAddon(this, 'VpcCni', {
      clusterName: cluster.clusterName,
      addonName: 'vpc-cni',
      resolveConflicts: 'OVERWRITE',
      configurationValues: JSON.stringify({
        enableNetworkPolicy: 'true',
        // starter: pod IPs come in /28 blocks, so a small node (t4g.medium: 17 pods by ENI count)
        // can run the whole app; the node's own cap is set in its NodeConfig below
        ...(starter ? { env: { ENABLE_PREFIX_DELEGATION: 'true', WARM_PREFIX_TARGET: '1' } } : {})
      })
    });
    const podsSg = cluster.clusterSecurityGroup;

    if (starter) {
      // the node claims the static IP at boot, so DNS and the Atlas allowlist never change when
      // a spot node is replaced
      const nodeScript = [
        'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="==KNOWHERE=="',
        '',
        '--==KNOWHERE==',
        'Content-Type: text/x-shellscript; charset="us-ascii"',
        '',
        '#!/bin/bash',
        'T=$(curl -sX PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 300")',
        'ID=$(curl -s -H "X-aws-ec2-metadata-token: $T" http://169.254.169.254/latest/meta-data/instance-id)',
        `aws ec2 associate-address --region ${this.region} --allocation-id ${egressIp.attrAllocationId} --instance-id "$ID" --allow-reassociation`,
        '',
        '--==KNOWHERE==',
        'Content-Type: application/node.eks.aws',
        '',
        '---',
        'apiVersion: node.eks.aws/v1alpha1',
        'kind: NodeConfig',
        'spec:',
        '  kubelet:',
        '    config:',
        // ~21 pods today; 40 leaves room without making kubelet reserve memory for 110
        '      maxPods: 40',
        '',
        '--==KNOWHERE==--',
        ''
      ].join('\n');
      const lt = new ec2.LaunchTemplate(this, 'NodeTemplate', {
        userData: ec2.UserData.custom(nodeScript),
        blockDevices: [
          { deviceName: '/dev/xvda', volume: ec2.BlockDeviceVolume.ebs(30, { encrypted: true }) }
        ]
      });
      const ng = cluster.addNodegroupCapacity('Nodes', {
        instanceTypes: [new ec2.InstanceType(props.nodeInstanceType)],
        amiType: arm
          ? eks.NodegroupAmiType.AL2023_ARM_64_STANDARD
          : eks.NodegroupAmiType.AL2023_X86_64_STANDARD,
        capacityType: props.spot ? eks.CapacityType.SPOT : eks.CapacityType.ON_DEMAND,
        minSize: 1,
        desiredSize: 1,
        maxSize: 2,
        subnets: nodeSubnets,
        launchTemplateSpec: { id: lt.launchTemplateId!, version: lt.latestVersionNumber }
      });
      ng.role.addToPrincipalPolicy(
        new iam.PolicyStatement({
          actions: ['ec2:AssociateAddress', 'ec2:DescribeAddresses'],
          resources: ['*']
        })
      );
      // Caddy (HTTPS) and LiveKit (WebRTC) listen on the node itself
      const open = (port: ec2.Port, why: string) =>
        podsSg.addIngressRule(ec2.Peer.anyIpv4(), port, why);
      open(ec2.Port.tcp(80), 'HTTP + ACME challenge');
      open(ec2.Port.tcp(443), 'HTTPS');
      if (!props.domainName) open(ec2.Port.tcp(7880), 'voice signalling (no domain)');
      open(ec2.Port.tcp(7881), 'WebRTC over TCP');
      open(ec2.Port.udp(3478), 'TURN');
      open(ec2.Port.udpRange(50000, 60000), 'WebRTC media');
    } else {
      cluster.addNodegroupCapacity('Nodes', {
        instanceTypes: [new ec2.InstanceType(props.nodeInstanceType)],
        amiType: arm
          ? eks.NodegroupAmiType.AL2023_ARM_64_STANDARD
          : eks.NodegroupAmiType.AL2023_X86_64_STANDARD,
        capacityType: props.spot ? eks.CapacityType.SPOT : eks.CapacityType.ON_DEMAND,
        minSize: Math.min(2, props.nodeCount),
        desiredSize: props.nodeCount,
        maxSize: Math.max(props.nodeCount, 6),
        diskSize: 40,
        subnets: nodeSubnets
      });
    }
    if (props.adminPrincipalArn) {
      cluster.grantAccess('Admin', props.adminPrincipalArn, [
        eks.AccessPolicy.fromAccessPolicyName('AmazonEKSClusterAdminPolicy', {
          accessScopeType: eks.AccessScopeType.CLUSTER
        })
      ]);
    }

    /* ------------------------------------------------------------------ secrets */
    const manifests = loadManifests(repoRoot, starter ? IN_CLUSTER_SKIP : EKS_SKIP);
    const refs = secretRefs(manifests);
    const secretsSm = appSecrets(this, refs);

    /* ------------------------------------------------------------------ standard: managed Redis, EC2 judge + voice, TLS */
    let redisUrl = 'redis://redis-service:6379';
    let livekitUrl = voiceDomain ? `wss://${voiceDomain}` : `ws://${egressIp.ref}:7880`;
    let judgeIp: string | undefined;
    let certificate: acm.ICertificate | undefined;
    if (!starter) {
      const redisSg = new ec2.SecurityGroup(this, 'RedisSg', {
        vpc,
        description: 'Redis from EKS'
      });
      redisSg.addIngressRule(podsSg, ec2.Port.tcp(6379), 'EKS pods');
      const redisSubnets = new elasticache.CfnSubnetGroup(this, 'RedisSubnets', {
        description: 'knowhere redis',
        subnetIds: vpc.privateSubnets.map((s) => s.subnetId)
      });
      const redis = new elasticache.CfnCacheCluster(this, 'Redis', {
        engine: 'redis',
        cacheNodeType: arm ? 'cache.t4g.small' : 'cache.t3.small',
        numCacheNodes: 1,
        cacheSubnetGroupName: redisSubnets.ref,
        vpcSecurityGroupIds: [redisSg.securityGroupId]
      });
      redisUrl = `redis://${redis.attrRedisEndpointAddress}:${redis.attrRedisEndpointPort}`;

      const hostRole = (rid: string) => {
        const role = new iam.Role(this, rid, {
          assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
        });
        // shell access through SSM Session Manager, no SSH keys or open port 22
        role.addManagedPolicy(
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
        );
        return role;
      };
      const al2023 = ec2.MachineImage.latestAmazonLinux2023({
        cpuType: arm ? ec2.AmazonLinuxCpuType.ARM_64 : ec2.AmazonLinuxCpuType.X86_64
      });

      const judgeSg = new ec2.SecurityGroup(this, 'JudgeSg', {
        vpc,
        description: 'judge API from EKS only'
      });
      judgeSg.addIngressRule(podsSg, ec2.Port.tcp(5010), 'course / coding / review services');
      const judgeRole = hostRole('JudgeRole');
      images['judge-runner'].repository.grantPull(judgeRole);
      const judge = new ec2.Instance(this, 'Judge', {
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        instanceType: new ec2.InstanceType(props.judgeInstanceType),
        machineImage: al2023,
        securityGroup: judgeSg,
        role: judgeRole,
        requireImdsv2: true,
        blockDevices: [
          { deviceName: '/dev/xvda', volume: ec2.BlockDeviceVolume.ebs(40, { encrypted: true }) }
        ],
        userData: ec2.UserData.custom(
          judgeBootScript({
            image: images['judge-runner'].imageUri,
            registry: `${this.account}.dkr.ecr.${this.region}.amazonaws.com`,
            region: this.region
          })
        ),
        // a new image (new boot script) replaces the instance instead of silently keeping the old one
        userDataCausesReplacement: true
      });
      judgeIp = judge.instancePrivateIp;

      const voiceIp = new ec2.CfnEIP(this, 'VoiceIp', { domain: 'vpc' });
      const livekitSg = new ec2.SecurityGroup(this, 'LivekitSg', {
        vpc,
        description: 'LiveKit WebRTC'
      });
      if (voiceDomain) {
        livekitSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'ACME HTTP challenge');
        livekitSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'wss signalling (Caddy)');
      } else {
        livekitSg.addIngressRule(
          ec2.Peer.anyIpv4(),
          ec2.Port.tcp(7880),
          'ws signalling (no domain)'
        );
      }
      livekitSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(7881), 'WebRTC over TCP');
      livekitSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udpRange(50000, 60000), 'WebRTC media');
      const livekitRole = hostRole('LivekitRole');
      secretsSm.livekit.grantRead(livekitRole);
      const livekit = new ec2.Instance(this, 'Livekit', {
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
        instanceType: new ec2.InstanceType(props.livekitInstanceType),
        machineImage: al2023,
        securityGroup: livekitSg,
        role: livekitRole,
        requireImdsv2: true,
        userData: ec2.UserData.custom(
          livekitBootScript({
            region: this.region,
            secretArn: secretsSm.livekit.secretArn,
            publicIp: voiceIp.ref,
            voiceDomain
          })
        ),
        userDataCausesReplacement: true
      });
      new ec2.CfnEIPAssociation(this, 'VoiceIpAssociation', {
        allocationId: voiceIp.attrAllocationId,
        instanceId: livekit.instanceId
      });
      livekitUrl = voiceDomain ? `wss://${voiceDomain}` : `ws://${voiceIp.ref}:7880`;

      if (zone && props.domainName) {
        certificate = new acm.Certificate(this, 'Certificate', {
          domainName: props.domainName,
          validation: acm.CertificateValidation.fromDns(zone)
        });
        new route53.ARecord(this, 'VoiceRecord', {
          zone,
          recordName: voiceDomain,
          target: route53.RecordTarget.fromIpAddresses(voiceIp.ref)
        });
      }
    } else if (zone && props.domainName) {
      // starter: the app and voice both live on the node's static IP
      for (const [rid, name] of [
        ['AppRecord', props.domainName],
        ['VoiceRecord', voiceDomain!]
      ]) {
        new route53.ARecord(this, rid, {
          zone,
          recordName: name,
          target: route53.RecordTarget.fromIpAddresses(egressIp.ref)
        });
      }
    }

    /* ------------------------------------------------------------------ in-cluster: IRSA, External Secrets, ExternalDNS */
    // course + media services reach S3 through this role; no static AWS keys anywhere
    const storageSa = cluster.addServiceAccount('StorageSa', {
      name: STORAGE_SA,
      namespace: 'default'
    });
    media.raw.grantReadWrite(storageSa);
    media.transcoded.grantReadWrite(storageSa);

    const esoNamespace = cluster.addManifest('EsoNamespace', {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: { name: 'external-secrets' }
    });
    const esoSa = cluster.addServiceAccount('EsoSa', {
      name: 'external-secrets',
      namespace: 'external-secrets'
    });
    esoSa.node.addDependency(esoNamespace);
    [...secretsSm.secrets, secretsSm.livekit].forEach((s) => s.grantRead(esoSa));
    const eso = cluster.addHelmChart('ExternalSecrets', {
      chart: 'external-secrets',
      repository: 'https://charts.external-secrets.io',
      version: '2.11.0',
      release: 'external-secrets',
      namespace: 'external-secrets',
      values: { installCRDs: true, serviceAccount: { create: false, name: 'external-secrets' } },
      // the SecretStore below is checked by this chart's webhook, so its pods must be running
      wait: true
    });
    eso.node.addDependency(esoSa, cluster.node.findChild('NodegroupNodes'));

    const store = cluster.addManifest('SecretStore', {
      apiVersion: 'external-secrets.io/v1',
      kind: 'ClusterSecretStore',
      metadata: { name: 'aws-secrets-manager' },
      spec: {
        provider: {
          aws: {
            service: 'SecretsManager',
            region: this.region,
            auth: {
              jwt: {
                serviceAccountRef: { name: 'external-secrets', namespace: 'external-secrets' }
              }
            }
          }
        }
      }
    });
    store.node.addDependency(eso);

    const externalSecret = (name: string, key: string, extra?: Record<string, string>) => ({
      apiVersion: 'external-secrets.io/v1',
      kind: 'ExternalSecret',
      metadata: { name, namespace: 'default' },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: { kind: 'ClusterSecretStore', name: 'aws-secrets-manager' },
        target: {
          name,
          creationPolicy: 'Owner',
          ...(extra ? { template: { mergePolicy: 'Merge', data: extra } } : {})
        },
        dataFrom: [{ extract: { key } }]
      }
    });
    const secrets = cluster.addManifest(
      'AppSecrets',
      ...secretsSm.names.map((name) => externalSecret(name, `knowhere/${name}`)),
      externalSecret('livekit', 'knowhere/livekit', { LIVEKIT_URL: livekitUrl }),
      // not sensitive: resource names and endpoints only (empty AWS keys = use the pod's IAM role)
      {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: { name: 'media-secrets', namespace: 'default' },
        stringData: {
          AWS_REGION: this.region,
          AWS_ACCESS_KEY_ID: '',
          AWS_SECRET_ACCESS_KEY: '',
          S3_RAW_BUCKET: media.raw.bucketName,
          S3_TRANSCODED_BUCKET: media.transcoded.bucketName,
          CLOUDFRONT_DOMAIN: ''
        }
      },
      {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: { name: 'redis', namespace: 'default' },
        stringData: { REDIS_URL: redisUrl }
      }
    );
    secrets.node.addDependency(store);

    if (!starter && zone && props.domainName) {
      const dnsSa = cluster.addServiceAccount('ExternalDnsSa', {
        name: 'external-dns',
        namespace: 'kube-system'
      });
      dnsSa.addToPrincipalPolicy(
        new iam.PolicyStatement({
          actions: ['route53:ChangeResourceRecordSets'],
          resources: [`arn:aws:route53:::hostedzone/${props.hostedZoneId}`]
        })
      );
      dnsSa.addToPrincipalPolicy(
        new iam.PolicyStatement({
          actions: [
            'route53:ListHostedZones',
            'route53:ListResourceRecordSets',
            'route53:ListTagsForResources'
          ],
          resources: ['*']
        })
      );
      // publishes <domainName> -> the ALB as soon as the ingress gets its address
      cluster
        .addHelmChart('ExternalDns', {
          chart: 'external-dns',
          repository: 'https://kubernetes-sigs.github.io/external-dns',
          version: '1.22.0',
          release: 'external-dns',
          namespace: 'kube-system',
          values: {
            provider: { name: 'aws' },
            serviceAccount: { create: false, name: 'external-dns' },
            domainFilters: [props.hostedZoneName],
            policy: 'upsert-only',
            txtOwnerId: 'knowhere',
            sources: ['ingress']
          }
        })
        .node.addDependency(dnsSa);
    }

    /* ------------------------------------------------------------------ the application */
    const imageUris = Object.fromEntries(Object.entries(images).map(([n, a]) => [n, a.imageUri]));
    const workloads = adaptForEks(manifests, {
      images: imageUris,
      storageWorkloads: ['course-deployment', 'media-deployment'],
      storageServiceAccount: STORAGE_SA,
      singleReplica: starter
    });
    const edge = starter
      ? caddyManifests(props.domainName)
      : [
          // JUDGE_URL=http://judge-service keeps working: the Service points at the EC2 judge
          {
            apiVersion: 'v1',
            kind: 'Service',
            metadata: { name: 'judge-service', namespace: 'default' },
            spec: { ports: [{ name: 'http', port: 80, targetPort: 5010 }] }
          },
          {
            apiVersion: 'v1',
            kind: 'Endpoints',
            metadata: { name: 'judge-service', namespace: 'default' },
            subsets: [{ addresses: [{ ip: judgeIp }], ports: [{ name: 'http', port: 5010 }] }]
          },
          // one ALB for everything: the frontend's nginx routes /api, /socket.io and the SPA
          {
            apiVersion: 'networking.k8s.io/v1',
            kind: 'Ingress',
            metadata: {
              name: 'knowhere',
              namespace: 'default',
              annotations: {
                'alb.ingress.kubernetes.io/scheme': 'internet-facing',
                'alb.ingress.kubernetes.io/target-type': 'ip',
                'alb.ingress.kubernetes.io/healthcheck-path': '/',
                // Socket.IO, voice signalling and streamed AI replies are long-lived
                'alb.ingress.kubernetes.io/load-balancer-attributes':
                  'idle_timeout.timeout_seconds=3600',
                ...(certificate
                  ? {
                      'alb.ingress.kubernetes.io/certificate-arn': certificate.certificateArn,
                      'alb.ingress.kubernetes.io/listen-ports': '[{"HTTP":80},{"HTTPS":443}]',
                      'alb.ingress.kubernetes.io/ssl-redirect': '443',
                      'external-dns.alpha.kubernetes.io/hostname': props.domainName!
                    }
                  : { 'alb.ingress.kubernetes.io/listen-ports': '[{"HTTP":80}]' })
              }
            },
            spec: {
              ingressClassName: 'alb',
              rules: [
                {
                  ...(props.domainName ? { host: props.domainName } : {}),
                  http: {
                    paths: [
                      {
                        path: '/',
                        pathType: 'Prefix',
                        backend: { service: { name: 'frontend-service', port: { number: 80 } } }
                      }
                    ]
                  }
                }
              ]
            }
          }
        ];
    const app = cluster.addManifest('App', ...workloads, ...edge);
    app.node.addDependency(secrets, storageSa);
    // the ALB controller must exist before the ingress is created
    if (cluster.albController) app.node.addDependency(cluster.albController);
    // apply Kubernetes resources one at a time (App last): new accounts have a tiny Lambda
    // concurrency quota, and parallel kubectl calls fail with "TooManyRequestsException: Rate Exceeded"
    const k8s = this.node
      .findAll()
      .filter(
        (c): c is CfnResource =>
          c instanceof CfnResource &&
          !c.node.path.startsWith(app.node.path + '/') &&
          /^Custom::AWSCDK-EKS-(KubernetesResource|HelmChart|KubernetesPatch|KubernetesObjectValue)$/.test(
            c.cfnResourceType
          )
      );
    k8s.reduce((prev, c) => (c.node.addDependency(prev), c));
    app.node.addDependency(...k8s);

    /* ------------------------------------------------------------------ outputs */
    new CfnOutput(this, 'Plan', {
      value: props.plan === 'starter' ? 'EKS Starter' : 'EKS Production'
    });
    new CfnOutput(this, 'Kubeconfig', {
      value: `aws eks update-kubeconfig --region ${this.region} --name ${cluster.clusterName}`
    });
    new CfnOutput(this, 'AtlasAllowlistIp', {
      value: egressIp.ref,
      description: 'Add to the MongoDB Atlas IP access list (all cluster egress uses it)'
    });
    new CfnOutput(this, 'AppUrl', {
      value: props.domainName
        ? `https://${props.domainName}`
        : starter
          ? `http://${egressIp.ref}`
          : 'kubectl get ingress knowhere -o jsonpath={.status.loadBalancer.ingress[0].hostname}'
    });
    new CfnOutput(this, 'VoiceUrl', { value: livekitUrl });
    new CfnOutput(this, 'SecretsToFill', {
      value: secretsSm.names.map((n) => `knowhere/${n}`).join(', '),
      description: 'Fill once: node infra/scripts/push-secrets.mjs'
    });
    if (media.crossAccount) {
      new CfnOutput(this, 'MediaAccount', {
        value: `${props.mediaAccount} (${media.mediaRegion}); bucket policy trusts ${storageRoleArnPattern(this.account)}`
      });
    }
    new CfnOutput(this, 'Buckets', {
      value: Fn.join(', ', [media.raw.bucketName, media.transcoded.bucketName])
    });
  }
}
