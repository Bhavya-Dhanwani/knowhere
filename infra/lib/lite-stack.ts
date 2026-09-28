import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { CfnOutput, Duration, Fn, Stack, StackProps, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import { adaptForEks, IN_CLUSTER_SKIP, loadManifests, secretRefs } from './manifests';
import { appSecrets, buildImages, caddyManifests, CommonProps, mediaStorage } from './common';

// AWS Lite: the whole app on ONE server running k3s (lightweight Kubernetes), from the same k8s/
// manifests. An Auto Scaling group of exactly one keeps it alive: a failed or reclaimed (spot)
// server is replaced automatically and the new one claims the same static IP. Every deploy
// replaces the server (~5 minutes downtime); all state lives in MongoDB Atlas and S3.

export interface LiteProps extends StackProps, CommonProps {
  hostedZoneId?: string;
  hostedZoneName?: string;
  instanceType: string;
  spot: boolean;
}

export class KnowhereLiteStack extends Stack {
  constructor(scope: Construct, id: string, props: LiteProps) {
    super(scope, id, props);
    const repoRoot = path.resolve(__dirname, '../..');
    const arm = props.arch === 'arm64';
    Tags.of(this).add('app', 'knowhere');
    Tags.of(this).add('plan', 'lite');

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 }]
    });
    const ip = new ec2.CfnEIP(this, 'ServerIp', { domain: 'vpc' });
    const images = buildImages(this, repoRoot, props.arch);
    const media = mediaStorage(this, props);

    /* ------------------------------------------------------------------ what runs on the server */
    const manifests = loadManifests(repoRoot, IN_CLUSTER_SKIP);
    const refs = secretRefs(manifests);
    const secrets = appSecrets(this, refs);
    // image URIs are only known at deploy time: placeholders in the file, filled in on the server
    const placeholders = Object.fromEntries(Object.keys(images).map((n) => [n, `__IMG_${n}__`]));
    const rendered = [
      ...adaptForEks(manifests, {
        images: placeholders,
        storageWorkloads: [],
        storageServiceAccount: '',
        singleReplica: true
      }),
      ...caddyManifests(props.domainName)
    ];
    const out = path.join(repoRoot, 'infra', 'cdk.out', 'lite-app.yaml');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, rendered.map((m) => yaml.dump(m, { lineWidth: -1 })).join('---\n'));
    const appAsset = new Asset(this, 'AppManifests', { path: out });

    const voiceUrl = props.domainName ? `wss://voice.${props.domainName}` : `ws://${ip.ref}:7880`;
    const substitutions = Object.entries(images)
      .map(([n, a]) => `  -e 's#__IMG_${n}__#${a.imageUri}#g' \\`)
      .join('\n');

    /* ------------------------------------------------------------------ permissions */
    const role = new iam.Role(this, 'ServerRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    });
    // shell through SSM Session Manager; no SSH keys, no port 22
    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
    );
    Object.values(images).forEach((i) => i.repository.grantPull(role));
    media.raw.grantReadWrite(role);
    media.transcoded.grantReadWrite(role);
    [...secrets.secrets, secrets.livekit].forEach((s) => s.grantRead(role));
    appAsset.grantRead(role);
    role.addToPrincipalPolicy(
      new iam.PolicyStatement({ actions: ['ec2:AssociateAddress'], resources: ['*'] })
    );

    /* ------------------------------------------------------------------ boot + resync scripts */
    const region = this.region;
    const script = `#!/bin/bash
set -euxo pipefail
dnf install -y jq
T=$(curl -sX PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
ID=$(curl -s -H "X-aws-ec2-metadata-token: $T" http://169.254.169.254/latest/meta-data/instance-id)
# the static IP: DNS and the MongoDB Atlas allowlist keep working across replacements
aws ec2 associate-address --region ${region} --allocation-id ${ip.attrAllocationId} --instance-id "$ID" --allow-reassociation
sleep 10

# k3s without Traefik: Caddy (in the manifests) serves 80/443
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik --write-kubeconfig-mode 600" sh -
until k3s kubectl get nodes 2>/dev/null | grep -q ' Ready'; do sleep 3; done

# images from ECR, pulled once per server (pods use IfNotPresent)
PASS=$(aws ecr get-login-password --region ${region})
for IMG in ${Object.values(images)
      .map((i) => i.imageUri)
      .join(' ')}; do
  k3s ctr -n k8s.io images pull --user "AWS:$PASS" "$IMG"
done

mkdir -p /etc/knowhere && chmod 700 /etc/knowhere
aws s3 cp '${appAsset.s3ObjectUrl}' /etc/knowhere/app.yaml --region ${region}
sed -i \\
${substitutions}
  /etc/knowhere/app.yaml

cat > /usr/local/bin/knowhere-sync.sh <<'SYNC'
#!/bin/bash
# secrets from Secrets Manager -> Kubernetes; restarts the app when any secret changed
set -euo pipefail
K="k3s kubectl"
OUT=$(mktemp)
for NAME in ${secrets.names.join(' ')}; do
  aws secretsmanager get-secret-value --region ${region} --secret-id "knowhere/$NAME" --query SecretString --output text \\
    | jq --arg n "$NAME" '{apiVersion:"v1",kind:"Secret",metadata:{name:$n,namespace:"default"},stringData:.}' >> "$OUT"
done
aws secretsmanager get-secret-value --region ${region} --secret-id knowhere/livekit --query SecretString --output text \\
  | jq '{apiVersion:"v1",kind:"Secret",metadata:{name:"livekit",namespace:"default"},stringData:(. + {LIVEKIT_URL:"${voiceUrl}"})}' >> "$OUT"
jq -n '{apiVersion:"v1",kind:"Secret",metadata:{name:"media-secrets",namespace:"default"},stringData:{AWS_REGION:"${region}",AWS_ACCESS_KEY_ID:"",AWS_SECRET_ACCESS_KEY:"",S3_RAW_BUCKET:"${media.raw.bucketName}",S3_TRANSCODED_BUCKET:"${media.transcoded.bucketName}",CLOUDFRONT_DOMAIN:""}}' >> "$OUT"
jq -n '{apiVersion:"v1",kind:"Secret",metadata:{name:"redis",namespace:"default"},stringData:{REDIS_URL:"redis://redis-service:6379"}}' >> "$OUT"
SUM=$(sha256sum "$OUT" | cut -d' ' -f1)
jq -s '{apiVersion:"v1",kind:"List",items:.}' "$OUT" | $K apply -f -
rm -f "$OUT"
$K apply -f /etc/knowhere/app.yaml
if [ "$(cat /etc/knowhere/secrets.sum 2>/dev/null)" != "$SUM" ]; then
  [ -f /etc/knowhere/secrets.sum ] && $K rollout restart deployment
  echo "$SUM" > /etc/knowhere/secrets.sum
fi
SYNC
chmod 700 /usr/local/bin/knowhere-sync.sh

cat > /etc/systemd/system/knowhere-sync.service <<'UNIT'
[Unit]
Description=Sync Knowhere secrets and manifests into k3s
After=k3s.service
[Service]
Type=oneshot
ExecStart=/usr/local/bin/knowhere-sync.sh
UNIT
cat > /etc/systemd/system/knowhere-sync.timer <<'UNIT'
[Unit]
Description=Resync Knowhere every 5 minutes (picks up secrets pushed after deploy)
[Timer]
OnBootSec=30
OnUnitActiveSec=5min
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now knowhere-sync.timer
`;

    /* ------------------------------------------------------------------ the server */
    const sg = new ec2.SecurityGroup(this, 'ServerSg', {
      vpc,
      description: 'Knowhere Lite: web + voice'
    });
    const open = (port: ec2.Port, why: string) => sg.addIngressRule(ec2.Peer.anyIpv4(), port, why);
    open(ec2.Port.tcp(80), 'HTTP + ACME challenge');
    open(ec2.Port.tcp(443), 'HTTPS');
    if (!props.domainName) open(ec2.Port.tcp(7880), 'voice signalling (no domain)');
    open(ec2.Port.tcp(7881), 'WebRTC over TCP');
    open(ec2.Port.udp(3478), 'TURN');
    open(ec2.Port.udpRange(50000, 60000), 'WebRTC media');

    const template = new ec2.LaunchTemplate(this, 'ServerTemplate', {
      instanceType: new ec2.InstanceType(props.instanceType),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: arm ? ec2.AmazonLinuxCpuType.ARM_64 : ec2.AmazonLinuxCpuType.X86_64
      }),
      role,
      securityGroup: sg,
      userData: ec2.UserData.custom(script),
      requireImdsv2: true,
      // pods reach the instance role (S3 access) through the metadata service: one extra hop
      httpPutResponseHopLimit: 2,
      associatePublicIpAddress: true,
      blockDevices: [
        { deviceName: '/dev/xvda', volume: ec2.BlockDeviceVolume.ebs(60, { encrypted: true }) }
      ],
      ...(props.spot ? { spotOptions: { requestType: ec2.SpotRequestType.ONE_TIME } } : {})
    });
    new autoscaling.AutoScalingGroup(this, 'Server', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      launchTemplate: template,
      minCapacity: 1,
      maxCapacity: 1,
      // a new template (new images or settings) replaces the server
      updatePolicy: autoscaling.UpdatePolicy.replacingUpdate(),
      healthChecks: autoscaling.HealthChecks.ec2({ gracePeriod: Duration.minutes(10) })
    });

    if (props.domainName && props.hostedZoneId && props.hostedZoneName) {
      const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.hostedZoneName
      });
      for (const [rid, name] of [
        ['AppRecord', props.domainName],
        ['VoiceRecord', `voice.${props.domainName}`]
      ]) {
        new route53.ARecord(this, rid, {
          zone,
          recordName: name,
          target: route53.RecordTarget.fromIpAddresses(ip.ref)
        });
      }
    }

    new CfnOutput(this, 'Plan', { value: `AWS Lite${props.spot ? ' Spot' : ''}` });
    new CfnOutput(this, 'AppUrl', {
      value: props.domainName ? `https://${props.domainName}` : `http://${ip.ref}`
    });
    new CfnOutput(this, 'VoiceUrl', { value: voiceUrl });
    new CfnOutput(this, 'AtlasAllowlistIp', {
      value: ip.ref,
      description: 'Add to the MongoDB Atlas IP access list'
    });
    new CfnOutput(this, 'Shell', {
      value: `aws ssm start-session --region ${region} --target <instance id from the EC2 console>, then: sudo k3s kubectl get pods`
    });
    new CfnOutput(this, 'SecretsToFill', {
      value: secrets.names.map((n) => `knowhere/${n}`).join(', '),
      description:
        'Fill once: node infra/scripts/push-secrets.mjs (the server picks them up within 5 minutes)'
    });
    new CfnOutput(this, 'Buckets', {
      value: Fn.join(', ', [media.raw.bucketName, media.transcoded.bucketName])
    });
  }
}
