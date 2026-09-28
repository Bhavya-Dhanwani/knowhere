# Knowhere on AWS (CDK)

One stack, `Knowhere`, deploys everything:

| Where                                                       | What                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **EKS** (Kubernetes 1.35, managed Graviton nodes)           | all web services + frontend, from the same `k8s/` manifests the local cluster uses               |
| **EC2** judge host (private subnet)                         | sandboxed code judge + allowlisting registry proxy; the judge container can reach only the proxy |
| **EC2** LiveKit host (public, Elastic IP)                   | voice SFU (WebRTC UDP 50000–60000), Caddy TLS for `wss://voice.<domain>`                         |
| **ECR**                                                     | 10 images, built from the repo's Dockerfiles and pushed by `cdk deploy`                          |
| **S3**                                                      | raw + transcoded media buckets (private, encrypted, CORS for the app origin)                     |
| **ElastiCache**                                             | Redis for Socket.IO / presence                                                                   |
| **Secrets Manager + External Secrets**                      | your secrets, synced into the cluster; LiveKit keys generated                                    |
| **ALB** (+ ACM, Route 53, ExternalDNS when a domain is set) | HTTPS entry point; the frontend's nginx routes `/api`, `/socket.io` and the SPA                  |

MongoDB stays on Atlas. All cluster egress leaves through one NAT IP (output `AtlasAllowlistIp`);
add it to the Atlas IP access list. Course and media services use S3 through an IAM role (IRSA):
no AWS keys are stored anywhere.

## Deploy

Requirements: AWS CLI with credentials, Node 22, Docker (with buildx), and, if your machine is x86,
QEMU for arm64 builds or `-c arch=amd64`.

```bash
cd infra
npm install
npx cdk bootstrap                         # once per account/region

# with a domain (recommended): TLS, DNS records and wss:// voice are set up for you
npx cdk deploy \
  -c domainName=lms.example.com \
  -c hostedZoneId=Z0123456789ABC -c hostedZoneName=example.com \
  -c adminPrincipalArn=arn:aws:iam::<account>:role/<your-admin-role>

# then, once: copy your secrets from k8s/secrets.yml into Secrets Manager
node scripts/push-secrets.mjs
```

Without `domainName` the app is served over plain HTTP on the ALB address and voice over
`ws://<ip>:7880`. That's fine for a smoke test. Browsers block microphone access and `ws://` on
non-HTTPS pages, so use a domain for real use.

Settings (`cdk.json` context or `-c key=value`): `region`, `arch` (`arm64` | `amd64`),
`nodeInstanceType`, `nodeCount`, `judgeInstanceType`, `livekitInstanceType`.

## S3 in a different AWS account

To keep uploaded media in account **B** while the app runs in account **A**:

```bash
# 1. account B (its own credentials): once, a bootstrap that lets CloudFormation touch only S3
npx cdk bootstrap aws://<B>/ap-south-1 --profile account-b \
  --cloudformation-execution-policies arn:aws:iam::aws:policy/AmazonS3FullAccess
#    then the buckets
npx cdk deploy KnowhereMedia --profile account-b \
  -c mediaAccount=<B> -c appAccount=<A> -c domainName=lms.example.com
# 2. account A: the app, pointed at B's buckets
npx cdk deploy Knowhere --profile account-a -c mediaAccount=<B> -c domainName=lms.example.com
```

In the deploy manager, fill in _S3 in another AWS account_ and its CLI profile. It checks that the
profile really is account B, bootstraps B the first time, and deploys both stacks in order.

- **Buckets in B:** encrypted (SSE-S3), private, "bucket owner enforced", with CORS for the app's
  domain.
- **Who can get in:** the bucket policy trusts only account A's storage role
  (`Knowhere-ClusterStorageSaRole*`), not the whole account. That role is the one the course and
  media services use, so uploads, downloads and presigned links work unchanged.
- **Tearing down:** destroying the app keeps B's buckets and your content.
- **App on GCP/Azure, storage still in B:** deploy `KnowhereMedia` alone (`-c mediaAccount=<B>`, no
  `appAccount`), create an IAM user in B limited to the two buckets, put its key in `media-secrets`,
  and set _Media in your AWS storage account_ = `yes` in the deploy manager. Details and exact
  policies: `deploy/deployment-guide.html`.

## After deploy

```bash
aws eks update-kubeconfig --region <region> --name knowhere     # output: Kubeconfig
kubectl get pods
kubectl get ingress knowhere                                     # ALB address (no domain)
```

- **Update the app:** run `npx cdk deploy` again. Changed images are rebuilt and pushed, and
  deployments roll. A new judge image replaces the judge instance.
- **Rotate a secret:** change it in Secrets Manager. External Secrets refreshes hourly; to apply
  now, `kubectl annotate externalsecret --all force-sync=$(date +%s) --overwrite`, then restart the
  deployment.
- **Shell on the EC2 hosts:** SSM Session Manager (`aws ssm start-session --target <instance-id>`).
  No SSH keys, no port 22.
- **Tear down:** `npx cdk destroy`. Media buckets are retained so uploaded content survives.
