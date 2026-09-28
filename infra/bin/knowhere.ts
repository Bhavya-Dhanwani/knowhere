#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { KnowhereStack } from '../lib/knowhere-stack';
import { KnowhereLiteStack } from '../lib/lite-stack';
import { KnowhereMediaStack } from '../lib/media-stack';

// Settings come from cdk.json "context" or the command line: cdk deploy -c plan=starter ...
// plan: standard (EKS Production) | starter (EKS Starter) | lite (one k3s server)
const app = new App();
const ctx = (key: string) => app.node.tryGetContext(key);
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: ctx('region') || process.env.CDK_DEFAULT_REGION || 'ap-south-1'
};
const common = {
  env,
  domainName: ctx('domainName') || undefined,
  hostedZoneId: ctx('hostedZoneId') || undefined,
  hostedZoneName: ctx('hostedZoneName') || undefined,
  arch: (ctx('arch') === 'amd64' ? 'amd64' : 'arm64') as 'arm64' | 'amd64',
  mediaAccount: ctx('mediaAccount') || undefined,
  mediaRegion: ctx('mediaRegion') || undefined
};
const plan = ctx('plan') || 'standard';
const spot = ['yes', 'true'].includes(String(ctx('spot')).toLowerCase());

// one stack name for every plan: switching plans is a redeploy of the same environment
if (plan === 'lite') {
  new KnowhereLiteStack(app, 'Knowhere', {
    ...common,
    instanceType: ctx('instanceType') || 't4g.xlarge',
    spot
  });
} else {
  new KnowhereStack(app, 'Knowhere', {
    ...common,
    plan: plan === 'starter' ? 'starter' : 'standard',
    adminPrincipalArn: ctx('adminPrincipalArn') || undefined,
    nodeInstanceType:
      ctx('instanceType') ||
      ctx('nodeInstanceType') ||
      (plan === 'starter' ? 't4g.xlarge' : 'm7g.large'),
    nodeCount: Number(ctx('nodeCount') || (plan === 'starter' ? 1 : 3)),
    spot,
    judgeInstanceType: ctx('judgeInstanceType') || 'c7g.xlarge',
    livekitInstanceType: ctx('livekitInstanceType') || 'c7g.large'
  });
}

// media buckets in a separate account: `cdk deploy KnowhereMedia` with that account's credentials
// (-c mediaAccount=<B>, plus -c appAccount=<A> when the app runs on AWS), then deploy the app
if (ctx('mediaAccount')) {
  new KnowhereMediaStack(app, 'KnowhereMedia', {
    env: { account: ctx('mediaAccount'), region: ctx('mediaRegion') || env.region },
    appAccount: ctx('appAccount') || undefined,
    appOrigin: ctx('domainName') ? `https://${ctx('domainName')}` : '*'
  });
}
