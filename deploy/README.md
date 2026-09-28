# Deploy manager

**Step-by-step AWS guide** (two accounts: app + S3, IAM policies, secrets): open
[`deployment-guide.html`](deployment-guide.html) in a browser.

One tool to deploy Knowhere to **AWS, Google Cloud, Azure or a local cluster**. It keeps a full
local history, can roll back to any earlier deployment, and has a web UI with live logs.

```bash
pnpm deployer                      # UI → open the printed http://127.0.0.1:4545/#token=… link
node deploy/cli.mjs deploy aws region=ap-south-1 domainName=lms.example.com
node deploy/cli.mjs deploy gcp project=my-project region=asia-south1
node deploy/cli.mjs deploy azure location=centralindia
node deploy/cli.mjs deploy local kubeContext=docker-desktop
node deploy/cli.mjs history
node deploy/cli.mjs rollback <deploymentId>
node deploy/cli.mjs destroy <environmentId>
```

## Platforms

| Platform | What gets created                                                                                                        | Needs                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `aws`    | the CDK stack in `infra/`: EKS, EC2 judge + LiveKit, S3, ElastiCache, ECR, Secrets Manager, ALB                          | `aws`, `docker`, `kubectl`                |
| `gcp`    | GKE Standard cluster, Artifact Registry, ingress-nginx; the `k8s/` stack as is (MinIO, Redis, LiveKit, judge in-cluster) | `gcloud`, `docker`, `kubectl`, `skaffold` |
| `azure`  | resource group, AKS, ACR, ingress-nginx; the `k8s/` stack as is                                                          | `az`, `docker`, `kubectl`, `skaffold`     |
| `local`  | nothing new: deploys into an existing cluster (Docker Desktop, kind)                                                     | `docker`, `kubectl`, `skaffold`           |

The app itself is the same everywhere (Kubernetes manifests and Docker images). Only the cloud
around it changes. To add a platform, add an entry to `providers/index.mjs`: `identity`,
`provision`, `deploy` and `destroy`.

For GCP, Azure and local, the cluster needs `k8s/secrets.yml`. It is read from your working
copy and never stored in the history. On AWS, secrets live in Secrets Manager (see
`infra/README.md`).

## Plans

The UI's **Plans & pricing** section lists 11 ready-made configurations (catalog: `plans.mjs`,
self-check: `node deploy/check-plans.mjs`). Each card shows the monthly price, what runs where,
reliability, scaling, limitations and a cost breakdown. The comparison table below the cards sorts
them by price. Filter by cloud or by a monthly budget. **Use this plan** fills in the deploy form;
you add only the account-specific fields (project, subscription, domain).

| Plan                           | ~$/month        | Shape                                                       |
| ------------------------------ | --------------- | ----------------------------------------------------------- |
| AWS Lite Spot / AWS Lite       | 39 / 89         | k3s on one EC2 server (spot / on-demand)                    |
| AWS EKS Starter                | 110             | EKS, 1 spot node, no NAT or load balancer                   |
| AWS EKS Production             | 500             | EKS, managed Redis, NAT, ALB, dedicated judge + voice hosts |
| GKE Spot / Budget / Production | 105 / 255 / 465 | zonal spot / zonal on-demand / regional                     |
| AKS Spot / Budget / Production | 101 / 161 / 398 | free tier + spot pool / free tier / Standard tier           |
| Local                          | 0               | Docker Desktop or kind                                      |

Prices are approximate list prices and exclude S3, data transfer, Atlas and Mistral. On AWS, the
plan maps to CDK context: `-c plan=lite|starter|standard -c spot=true -c instanceType=...`.

## History and rollback

Everything is kept in `deploy/.state/` (gitignored):

- **`history.json`:** every environment and every deploy, rollback and teardown, with who ran it,
  the settings, the outputs and the exact image tags.
- **`logs/<id>.log`:** the full output of each run.
- **Source snapshot:** each deploy snapshots the working tree, including uncommitted changes but
  not ignored files such as secrets, as the git ref `refs/deploys/<id>`. It works from a separate
  checkout, so your working tree, index and branch are never touched.

**Rollback** redeploys a recorded snapshot to the same environment. On GCP, Azure and local it
re-applies the exact recorded images, with no rebuild. On AWS it redeploys the recorded source
through CDK; unchanged images aren't rebuilt or re-pushed. A rollback is refused if you are signed
in to a different account or project than the deployment it targets.

## Changed credentials

Before every run the tool asks the platform who you are:

| Platform | Identity check                              |
| -------- | ------------------------------------------- |
| AWS      | `aws sts get-caller-identity`               |
| GCP      | `gcloud config get-value account` + project |
| Azure    | `az account show`                           |

It then compares that with the environment's last deployment.

- **Different account, project or subscription:** this is a new environment, deployed completely
  from scratch.
- **Same account but a different IAM user or principal:** the run becomes a complete new
  deployment. It re-bootstraps (AWS) or re-provisions (GCP, Azure), then redeploys every
  resource: `cdk deploy --force`, or a full re-apply.

## UI

The UI shows environments with their app URLs, the full history with _Roll back here_ buttons,
live deployment logs, pod status, and live application logs for any deployment or pod.

It controls real infrastructure, so it listens on `127.0.0.1` only. Every request needs the
random token printed at start, and requests with any other Host header are rejected. That stops
other websites and DNS-rebinding tricks from driving it through your browser.
