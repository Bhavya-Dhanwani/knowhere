import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { kubernetesDeploy, ensureIngress } from './kubernetes.mjs';

// One entry per platform. Each says how to find out who you are (identity), how to set up a
// brand-new environment (provision: first deploy, or after the credentials changed), how to
// deploy / roll back, and how to tear down. `fields` drive the form in the local UI.

const json = (s) => JSON.parse(s);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);

/* ------------------------------------------------------------------ AWS: CDK stack (infra/) */
const aws = {
  id: 'aws',
  label: 'AWS (EKS + EC2, CDK)',
  requires: ['aws', 'kubectl', 'docker'],
  fields: [
    { key: 'plan', label: 'Plan: standard (EKS Production) | starter (EKS Starter) | lite (one k3s server)', default: 'standard', required: true },
    { key: 'spot', label: 'Spot capacity (yes | no)', default: 'no' },
    { key: 'instanceType', label: 'Server / node type (blank = plan default)' },
    { key: 'region', label: 'Region', default: 'ap-south-1', required: true },
    { key: 'profile', label: 'AWS CLI profile (blank = default)' },
    { key: 'domainName', label: 'App domain, e.g. lms.example.com' },
    { key: 'hostedZoneId', label: 'Route 53 hosted zone ID' },
    { key: 'hostedZoneName', label: 'Hosted zone name, e.g. example.com' },
    { key: 'adminPrincipalArn', label: 'IAM ARN to get kubectl admin' },
    { key: 'arch', label: 'CPU architecture (arm64 | amd64)', default: 'arm64' },
    { key: 'nodeCount', label: 'EKS nodes', default: '3' },
    { key: 'mediaAccount', label: 'S3 in another AWS account: its account ID (blank = same account)' },
    { key: 'mediaProfile', label: 'AWS CLI profile for that account' },
    { key: 'mediaRegion', label: 'Region of the media buckets (blank = same region)' }
  ],
  env: (cfg) => (cfg.profile ? { AWS_PROFILE: cfg.profile } : {}),
  mediaEnv: (cfg) => (cfg.mediaProfile ? { AWS_PROFILE: cfg.mediaProfile } : {}),
  async identity(cfg, x) {
    const id = json(
      await x.run('aws', ['sts', 'get-caller-identity', '--output', 'json'], { quiet: true, env: aws.env(cfg) })
    );
    return { account: id.Account, principal: id.Arn, display: `${id.Arn} (account ${id.Account})` };
  },
  envId: (i, cfg) => `aws:${i.account}:${cfg.region}`,
  cdkArgs(cfg, appAccount) {
    const c = ['plan', 'spot', 'instanceType', 'region', 'domainName', 'hostedZoneId', 'hostedZoneName', 'adminPrincipalArn', 'arch', 'nodeCount', 'mediaAccount', 'mediaRegion'];
    return [
      ...c.filter((k) => cfg[k]).flatMap((k) => ['-c', `${k}=${cfg[k]}`]),
      ...(cfg.mediaAccount && appAccount ? ['-c', `appAccount=${appAccount}`] : [])
    ];
  },
  // media buckets in another account: that account's credentials must really be that account
  async mediaIdentity(ctx) {
    if (!ctx.cfg.mediaAccount || ctx.cfg.mediaAccount === ctx.identity.account) return null;
    const id = json(
      await ctx.run('aws', ['sts', 'get-caller-identity', '--output', 'json'], { quiet: true, env: aws.mediaEnv(ctx.cfg) })
    );
    if (id.Account !== ctx.cfg.mediaAccount) {
      throw new Error(
        `The media profile "${ctx.cfg.mediaProfile || 'default'}" is account ${id.Account}, not ${ctx.cfg.mediaAccount}.`
      );
    }
    return id;
  },
  async provision(ctx) {
    const infra = path.join(ctx.cwd, 'infra');
    await ctx.run('npm', ['install', '--no-audit', '--no-fund'], { cwd: infra });
    await ctx.run('npx', ['cdk', 'bootstrap', `aws://${ctx.identity.account}/${ctx.cfg.region}`], {
      cwd: infra,
      env: aws.env(ctx.cfg)
    });
    if (await aws.mediaIdentity(ctx)) {
      const region = ctx.cfg.mediaRegion || ctx.cfg.region;
      // the media stack is only buckets: CloudFormation in that account may touch S3 and nothing else
      await ctx.run('npx', [
        'cdk',
        'bootstrap',
        `aws://${ctx.cfg.mediaAccount}/${region}`,
        '--cloudformation-execution-policies',
        'arn:aws:iam::aws:policy/AmazonS3FullAccess'
      ], {
        cwd: infra,
        env: aws.mediaEnv(ctx.cfg)
      });
    }
  },
  async deploy(ctx) {
    const infra = path.join(ctx.cwd, 'infra');
    const env = { ...aws.env(ctx.cfg), CDK_DEFAULT_ACCOUNT: ctx.identity.account, CDK_DEFAULT_REGION: ctx.cfg.region };
    await ctx.run('npm', ['install', '--no-audit', '--no-fund'], { cwd: infra });
    const outputs = path.join(ctx.art, 'outputs.json');
    // media account first: the app's role is granted access to buckets that must already exist
    if (await aws.mediaIdentity(ctx)) {
      ctx.note(`deploying media buckets to account ${ctx.cfg.mediaAccount}`);
      await ctx.run(
        'npx',
        ['cdk', 'deploy', 'KnowhereMedia', '--require-approval', 'never', ...(ctx.fresh ? ['--force'] : []), ...aws.cdkArgs(ctx.cfg, ctx.identity.account)],
        {
          cwd: infra,
          env: { ...aws.mediaEnv(ctx.cfg), CDK_DEFAULT_ACCOUNT: ctx.cfg.mediaAccount, CDK_DEFAULT_REGION: ctx.cfg.mediaRegion || ctx.cfg.region }
        }
      );
    }
    await ctx.run(
      'npx',
      [
        'cdk',
        'deploy',
        'Knowhere',
        '--require-approval',
        'never',
        '--outputs-file',
        outputs,
        // a fresh environment (or new credentials) redeploys everything, changed or not
        ...(ctx.fresh ? ['--force'] : []),
        ...aws.cdkArgs(ctx.cfg, ctx.identity.account)
      ],
      { cwd: infra, env }
    );
    const out = existsSync(outputs) ? json(readFileSync(outputs, 'utf8')).Knowhere || {} : {};
    // Lite runs k3s on the server itself: no kubeconfig here (shell in via SSM, see the outputs)
    if (ctx.cfg.plan === 'lite') return { outputs: out };
    const kubeContext = `knowhere-aws-${ctx.identity.account}-${ctx.cfg.region}`;
    await ctx.run(
      'aws',
      ['eks', 'update-kubeconfig', '--region', ctx.cfg.region, '--name', 'knowhere', '--alias', kubeContext],
      { env: aws.env(ctx.cfg) }
    );
    return { kubeContext, outputs: out };
  },
  async destroy(ctx) {
    const infra = path.join(ctx.cwd, 'infra');
    await ctx.run('npm', ['install', '--no-audit', '--no-fund'], { cwd: infra });
    // the media stack (other account) keeps its buckets: RETAIN, so uploaded content survives
    await ctx.run('npx', ['cdk', 'destroy', 'Knowhere', '--force', ...aws.cdkArgs(ctx.cfg, ctx.identity.account)], {
      cwd: infra,
      env: { ...aws.env(ctx.cfg), CDK_DEFAULT_ACCOUNT: ctx.identity.account, CDK_DEFAULT_REGION: ctx.cfg.region }
    });
  }
};

/* ------------------------------------------------------------------ GCP: GKE + Artifact Registry */
// zonal clusters (budget plans) or regional ones (production, spread over three zones)
const gcpWhere = (cfg) => (cfg.locationType === 'regional' ? ['--region', cfg.region] : ['--zone', cfg.zone]);
const gcpLocation = (cfg) => (cfg.locationType === 'regional' ? cfg.region : cfg.zone);
const gcpContext = (ctx) => `knowhere-gcp-${slug(ctx.cfg.project)}-${gcpLocation(ctx.cfg)}`;
const gcp = {
  id: 'gcp',
  label: 'Google Cloud (GKE)',
  requires: ['gcloud', 'kubectl', 'skaffold', 'docker'],
  fields: [
    { key: 'project', label: 'Project ID', required: true },
    { key: 'locationType', label: 'Cluster: zonal (budget) | regional (HA)', default: 'zonal', required: true },
    { key: 'zone', label: 'Zone (zonal clusters)', default: 'asia-south1-a' },
    { key: 'region', label: 'Region (registry, regional clusters)', default: 'asia-south1', required: true },
    { key: 'machineType', label: 'Node machine type', default: 'e2-standard-4' },
    { key: 'nodes', label: 'Nodes (per zone for regional)', default: '2' },
    { key: 'spot', label: 'Spot nodes (yes | no)', default: 'no' },
    { key: 'publicUrl', label: 'Public URL (blank = load balancer IP)' },
    { key: 'voiceUrl', label: 'Voice URL, e.g. wss://voice.example.com' },
    { key: 'mediaInS3', label: 'Media in your AWS storage account (S3) instead of in-cluster MinIO (yes | no)', default: 'no' }
  ],
  async identity(cfg, x) {
    const account = (await x.run('gcloud', ['config', 'get-value', 'account'], { quiet: true })).trim();
    if (!account) throw new Error('gcloud is not signed in: run `gcloud auth login`.');
    return { account: cfg.project, principal: account, display: `${account} (project ${cfg.project})` };
  },
  envId: (i, cfg) => `gcp:${cfg.project}:${gcpLocation(cfg)}`,
  async provision(ctx) {
    const { project, region } = ctx.cfg;
    const g = (args, o) => ctx.run('gcloud', [...args, '--project', project], o);
    await g(['services', 'enable', 'container.googleapis.com', 'artifactregistry.googleapis.com']);
    await g(['artifacts', 'repositories', 'create', 'knowhere', '--repository-format=docker', `--location=${region}`]).catch(
      () => ctx.note('Artifact Registry repository already exists')
    );
    const exists = await g(['container', 'clusters', 'describe', 'knowhere', ...gcpWhere(ctx.cfg)], { quiet: true }).then(
      () => true,
      () => false
    );
    if (!exists) {
      const nodes = Number(ctx.cfg.nodes || 2);
      // Standard (not Autopilot): the judge needs an unconfined seccomp profile
      await g([
        'container', 'clusters', 'create', 'knowhere', ...gcpWhere(ctx.cfg),
        '--machine-type', ctx.cfg.machineType || 'e2-standard-4',
        '--num-nodes', String(nodes),
        '--disk-size', ctx.cfg.locationType === 'regional' ? '100' : '50',
        '--enable-autoscaling', '--min-nodes', String(Math.max(1, nodes)), '--max-nodes', String(nodes + (ctx.cfg.locationType === 'regional' ? 3 : 1)),
        ...(ctx.cfg.spot === 'yes' ? ['--spot'] : [])
      ]);
    }
    await g(['container', 'clusters', 'get-credentials', 'knowhere', ...gcpWhere(ctx.cfg)]);
    await ctx
      .run('kubectl', ['config', 'rename-context', `gke_${project}_${gcpLocation(ctx.cfg)}_knowhere`, gcpContext(ctx)])
      .catch(() => ctx.note('kube context already named'));
    await ctx.run('gcloud', ['auth', 'configure-docker', `${region}-docker.pkg.dev`, '--quiet']);
    await ensureIngress(ctx, gcpContext(ctx));
  },
  deploy: kubernetesDeploy({
    registry: (ctx) => `${ctx.cfg.region}-docker.pkg.dev/${ctx.cfg.project}/knowhere`,
    push: true,
    kubeContext: gcpContext
  }),
  async destroy(ctx) {
    const { project, region } = ctx.cfg;
    await ctx.run('gcloud', ['container', 'clusters', 'delete', 'knowhere', ...gcpWhere(ctx.cfg), '--project', project, '--quiet']);
    await ctx.run('gcloud', ['artifacts', 'repositories', 'delete', 'knowhere', `--location=${region}`, '--project', project, '--quiet']);
  }
};

/* ------------------------------------------------------------------ Azure: AKS + ACR */
const acrName = (ctx) => `knowhere${slug(ctx.identity.account).replace(/-/g, '').slice(0, 12)}`;
const azContext = (ctx) => `knowhere-azure-${slug(ctx.identity.account).slice(0, 12)}-${ctx.cfg.location}`;
const azure = {
  id: 'azure',
  label: 'Microsoft Azure (AKS)',
  requires: ['az', 'kubectl', 'skaffold', 'docker'],
  fields: [
    { key: 'location', label: 'Location', default: 'centralindia', required: true },
    { key: 'resourceGroup', label: 'Resource group', default: 'knowhere' },
    { key: 'tier', label: 'Control plane: free | standard (uptime SLA)', default: 'free' },
    { key: 'nodeSize', label: 'App node VM size', default: 'Standard_D4as_v5' },
    { key: 'nodeCount', label: 'App nodes', default: '1' },
    { key: 'spot', label: 'Spot app nodes (yes | no)', default: 'no' },
    { key: 'systemSize', label: 'System node VM size (spot plans)', default: 'Standard_B2s' },
    { key: 'publicUrl', label: 'Public URL (blank = load balancer IP)' },
    { key: 'voiceUrl', label: 'Voice URL, e.g. wss://voice.example.com' },
    { key: 'mediaInS3', label: 'Media in your AWS storage account (S3) instead of in-cluster MinIO (yes | no)', default: 'no' }
  ],
  async identity(_cfg, x) {
    const a = json(await x.run('az', ['account', 'show', '--output', 'json'], { quiet: true }));
    return { account: a.id, principal: a.user?.name, display: `${a.user?.name} (subscription ${a.name})` };
  },
  envId: (i, cfg) => `azure:${i.account}:${cfg.location}`,
  async provision(ctx) {
    const rg = ctx.cfg.resourceGroup || 'knowhere';
    await ctx.run('az', ['group', 'create', '-n', rg, '-l', ctx.cfg.location, '--output', 'none']);
    await ctx.run('az', ['acr', 'create', '-g', rg, '-n', acrName(ctx), '--sku', 'Basic', '--output', 'none']).catch(() =>
      ctx.note('registry already exists')
    );
    const exists = await ctx
      .run('az', ['aks', 'show', '-g', rg, '-n', 'knowhere', '--output', 'none'], { quiet: true })
      .then(() => true, () => false);
    const spot = ctx.cfg.spot === 'yes';
    const count = ctx.cfg.nodeCount || '1';
    if (!exists) {
      // spot plans: a small on-demand system pool for Kubernetes itself, the app on a spot pool
      await ctx.run('az', [
        'aks', 'create', '-g', rg, '-n', 'knowhere', '--tier', ctx.cfg.tier || 'free',
        '--node-count', spot ? '1' : count,
        '--node-vm-size', spot ? ctx.cfg.systemSize || 'Standard_B2s' : ctx.cfg.nodeSize || 'Standard_D4as_v5',
        ...(spot ? [] : ['--enable-cluster-autoscaler', '--min-count', count, '--max-count', String(Number(count) * 2)]),
        '--attach-acr', acrName(ctx), '--generate-ssh-keys', '--output', 'none'
      ]);
    }
    if (spot) {
      const pool = await ctx
        .run('az', ['aks', 'nodepool', 'show', '-g', rg, '--cluster-name', 'knowhere', '-n', 'spot', '--output', 'none'], { quiet: true })
        .then(() => true, () => false);
      if (!pool) {
        await ctx.run('az', [
          'aks', 'nodepool', 'add', '-g', rg, '--cluster-name', 'knowhere', '-n', 'spot',
          '--priority', 'Spot', '--eviction-policy', 'Delete', '--spot-max-price', '-1',
          '--node-vm-size', ctx.cfg.nodeSize || 'Standard_D4as_v5', '--node-count', count,
          '--enable-cluster-autoscaler', '--min-count', count, '--max-count', String(Number(count) + 1), '--output', 'none'
        ]);
      }
    }
    await ctx.run('az', ['aks', 'get-credentials', '-g', rg, '-n', 'knowhere', '--context', azContext(ctx), '--overwrite-existing']);
    await ctx.run('az', ['acr', 'login', '-n', acrName(ctx)]);
    await ensureIngress(ctx, azContext(ctx));
  },
  deploy: kubernetesDeploy({
    registry: (ctx) => `${acrName(ctx)}.azurecr.io`,
    push: true,
    kubeContext: azContext,
    tolerateSpot: (ctx) => ctx.cfg.spot === 'yes'
  }),
  async destroy(ctx) {
    await ctx.run('az', ['group', 'delete', '-n', ctx.cfg.resourceGroup || 'knowhere', '--yes', '--no-wait']);
  }
};

/* ------------------------------------------------------------------ local cluster (Docker Desktop, kind, ...) */
const local = {
  id: 'local',
  label: 'Local Kubernetes (Docker Desktop / kind)',
  requires: ['kubectl', 'skaffold', 'docker'],
  fields: [
    { key: 'kubeContext', label: 'kube context', default: 'docker-desktop', required: true },
    { key: 'publicUrl', label: 'Public URL', default: 'http://localhost:3000' }
  ],
  async identity(cfg, x) {
    const server = (
      await x.run(
        'kubectl',
        ['config', 'view', '-o', `jsonpath={.clusters[?(@.name=="${cfg.kubeContext}")].cluster.server}`],
        { quiet: true }
      )
    ).trim();
    if (!server) throw new Error(`No kube context named "${cfg.kubeContext}".`);
    return { account: cfg.kubeContext, principal: server, display: `${cfg.kubeContext} (${server})` };
  },
  envId: (_i, cfg) => `local:${cfg.kubeContext}`,
  async provision(ctx) {
    await ctx.run('kubectl', ['cluster-info', '--context', ctx.cfg.kubeContext]);
  },
  deploy: kubernetesDeploy({ registry: () => undefined, push: false, kubeContext: (ctx) => ctx.cfg.kubeContext }),
  async destroy(ctx) {
    const overlay = path.join(ctx.cwd, 'deploy-overlay');
    await ctx.run('kubectl', ['delete', '-k', existsSync(overlay) ? overlay : path.join(ctx.cwd, 'k8s'), '--context', ctx.cfg.kubeContext, '--ignore-not-found']);
  }
};

export const PROVIDERS = { aws, gcp, azure, local };
