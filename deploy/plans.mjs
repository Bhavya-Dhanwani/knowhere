// Deployment plans: ready-made configurations per cloud, with what they cost, what runs where and
// what you give up. The UI shows these side by side; choosing one pre-fills the deploy form.
//
// Prices: approximate on-demand list prices, per month (730 h), India regions (AWS ap-south-1,
// GCP asia-south1, Azure centralindia), before taxes and credits. Object storage (S3 / GCS /
// Blob) and internet data transfer are NOT included; MongoDB Atlas and Mistral are billed
// separately on every plan. Check the providers' calculators before committing.

export const PRICING_NOTE =
  'Approximate on-demand list prices per month (India regions), excluding object storage, data transfer, MongoDB Atlas and Mistral. Spot prices move with demand.';

export const PLANS = [
  /* ------------------------------------------------------------------ AWS */
  {
    id: 'aws-lite-spot',
    provider: 'aws',
    name: 'AWS Lite Spot',
    tagline: 'Cheapest AWS: one spot server running k3s',
    monthly: 39,
    breakdown: [
      ['1 × t4g.xlarge spot (4 vCPU, 16 GB, ARM)', 28],
      ['60 GB disk', 5.5],
      ['Static public IP', 3.65],
      ['Secrets Manager', 2]
    ],
    specs: { kubernetes: 'k3s (lightweight Kubernetes) on 1 server', capacity: '4 vCPU · 16 GB', nodes: '1' },
    runs: ['All services, Redis, judge and LiveKit voice on the one server', 'Caddy for HTTPS', 'Media in S3'],
    reliability: 'Spot: AWS can reclaim the server (2-minute notice); a replacement starts automatically in ~5 minutes',
    scaling: 'None automatic. Upgrade the plan or add a worker server',
    limitations: [
      'Single server: any failure means downtime until it is replaced',
      'Spot interruptions a few times a month are normal',
      'Every deploy replaces the server (~5 minutes downtime)',
      'The code judge competes with the app for the same 4 CPUs'
    ],
    bestFor: 'Demos, development, a small pilot cohort',
    setupMinutes: 15,
    cfg: { plan: 'lite', spot: 'yes', instanceType: 't4g.xlarge', arch: 'arm64' }
  },
  {
    id: 'aws-lite',
    provider: 'aws',
    name: 'AWS Lite',
    tagline: 'One steady server running k3s',
    monthly: 89,
    breakdown: [
      ['1 × t4g.xlarge on-demand (4 vCPU, 16 GB, ARM)', 78],
      ['60 GB disk', 5.5],
      ['Static public IP', 3.65],
      ['Secrets Manager', 2]
    ],
    specs: { kubernetes: 'k3s (lightweight Kubernetes) on 1 server', capacity: '4 vCPU · 16 GB', nodes: '1' },
    runs: ['All services, Redis, judge and LiveKit voice on the one server', 'Caddy for HTTPS', 'Media in S3'],
    reliability: 'No interruptions; if the server fails, AWS starts a replacement automatically (~5 minutes)',
    scaling: 'None automatic. Upgrade the plan or add a worker server',
    limitations: [
      'Single server: a failure means a few minutes of downtime',
      'Every deploy replaces the server (~5 minutes downtime)',
      'The code judge competes with the app for the same 4 CPUs'
    ],
    bestFor: 'Small production (a few hundred active learners), a stable pilot',
    setupMinutes: 15,
    cfg: { plan: 'lite', spot: 'no', instanceType: 't4g.xlarge', arch: 'arm64' }
  },
  {
    id: 'aws-eks-starter',
    provider: 'aws',
    name: 'EKS Starter',
    tagline: 'Real EKS, trimmed to one spot node',
    monthly: 109,
    breakdown: [
      ['EKS control plane', 73],
      ['1 × t4g.xlarge spot node (4 vCPU, 16 GB)', 28],
      ['30 GB disk', 2.75],
      ['Static public IP', 3.65],
      ['Secrets Manager', 2]
    ],
    specs: { kubernetes: 'Amazon EKS (managed)', capacity: '4 vCPU · 16 GB', nodes: '1 (up to 2)' },
    runs: ['All services, Redis, judge and LiveKit voice in the cluster', 'Caddy for HTTPS (no load balancer)', 'Media in S3'],
    reliability: 'Spot node: can be reclaimed; EKS starts a new node (~5 minutes of downtime)',
    scaling: 'Node group can grow to 2 nodes; raise the limit later without redesigning',
    limitations: [
      'EKS itself costs $73 of the $109, leaving little for compute',
      'One node: no failover while a node is replaced',
      'No NAT gateway: nodes sit in a public subnet (locked down by a security group)',
      'Same code path as EKS Production: growing later is a settings change'
    ],
    bestFor: 'Teams that need EKS specifically (skills, compliance) on a small budget',
    setupMinutes: 30,
    cfg: { plan: 'starter', spot: 'yes', instanceType: 't4g.xlarge', arch: 'arm64', nodeCount: '1' }
  },
  {
    id: 'aws-eks-lean',
    provider: 'aws',
    name: 'EKS Lean',
    tagline: 'Always-on EKS under $100: one small spot node',
    monthly: 89,
    breakdown: [
      ['EKS control plane', 73],
      ['1 × t4g.medium spot node (2 vCPU, 4 GB)', 7],
      ['30 GB disk', 2.75],
      ['Static public IP', 3.65],
      ['Secrets Manager', 2],
      ['Container images (ECR)', 0.5]
    ],
    specs: { kubernetes: 'Amazon EKS (managed)', capacity: '2 vCPU · 4 GB', nodes: '1' },
    runs: [
      'All services (one copy each), Redis, judge and LiveKit voice in the cluster',
      'Caddy for HTTPS (no load balancer)',
      'Media in S3'
    ],
    reliability: 'Spot node: can be reclaimed; EKS starts a new node (~5 minutes of downtime)',
    scaling: 'None in practice: sized for a handful of users. Switch to EKS Starter to grow',
    limitations: [
      'Sized for about 5 people at a time; 4 GB is tight',
      'Several heavy code runs at once can run the node out of memory (pods restart)',
      'Each deploy restarts every service briefly (no room for a second copy)',
      'Only ~$11/month headroom under $100; watch data transfer beyond 100 GB/month',
      'EKS itself is $73 of the $89: the control plane is billed even when idle'
    ],
    bestFor: 'A small group (4–5 people, 1–2 h a day) that needs EKS on a $100 budget',
    setupMinutes: 30,
    cfg: { plan: 'starter', spot: 'yes', instanceType: 't4g.medium', arch: 'arm64', nodeCount: '1' }
  },
  {
    id: 'aws-eks-production',
    provider: 'aws',
    name: 'EKS Production',
    tagline: 'Highly available, managed services, isolated judge',
    monthly: 500,
    breakdown: [
      ['EKS control plane', 73],
      ['3 × m7g.large nodes + disks', 180],
      ['Judge server (c7g.xlarge, isolated)', 90],
      ['Voice server (c7g.large + static IP)', 45],
      ['NAT gateway', 45],
      ['Load balancer (ALB)', 22],
      ['Redis (ElastiCache t4g.small)', 25],
      ['Public IPs', 15],
      ['Secrets, registry, DNS, logs', 5]
    ],
    specs: { kubernetes: 'Amazon EKS (managed)', capacity: '6 vCPU · 24 GB for the app + dedicated judge and voice servers', nodes: '3 (up to 6)' },
    runs: ['Web services in EKS (private subnets)', 'Judge and voice on their own EC2 servers', 'Managed Redis, ALB with HTTPS, media in S3'],
    reliability: 'Survives a node or zone failure; rolling deploys with no downtime',
    scaling: 'Nodes scale 3 → 6; judge and voice servers can be resized independently',
    limitations: ['Highest cost', 'About 30–40 minutes for the first deploy'],
    bestFor: 'Real production with many concurrent learners',
    setupMinutes: 40,
    cfg: { plan: 'standard', spot: 'no', instanceType: 'm7g.large', nodeCount: '3', arch: 'arm64' }
  },

  /* ------------------------------------------------------------------ Google Cloud */
  {
    id: 'gcp-spot',
    provider: 'gcp',
    name: 'GKE Spot',
    tagline: 'Zonal GKE with two spot nodes',
    monthly: 105,
    breakdown: [
      ['GKE management fee (covered by the free zonal-cluster credit)', 0],
      ['2 × e2-standard-4 spot (4 vCPU, 16 GB each)', 76],
      ['2 × 50 GB disks', 11],
      ['Load balancer', 18]
    ],
    specs: { kubernetes: 'GKE Standard, zonal', capacity: '8 vCPU · 32 GB', nodes: '2 (up to 3)' },
    runs: ['Everything in the cluster: services, MinIO storage, Redis, judge, voice', 'ingress-nginx load balancer'],
    reliability: 'Spot nodes can be reclaimed; with 2 nodes the app usually keeps running on the other',
    scaling: 'Autoscales 2 → 3 spot nodes',
    limitations: [
      'Spot nodes: expect restarts',
      'Single zone: a zone outage takes the site down',
      'Free credit covers one zonal cluster per billing account only'
    ],
    bestFor: 'Best capacity for the money on GCP; staging, pilots',
    setupMinutes: 20,
    cfg: { locationType: 'zonal', zone: 'asia-south1-a', region: 'asia-south1', machineType: 'e2-standard-4', nodes: '2', spot: 'yes' }
  },
  {
    id: 'gcp-budget',
    provider: 'gcp',
    name: 'GKE Budget',
    tagline: 'Zonal GKE, two steady nodes',
    monthly: 255,
    breakdown: [
      ['GKE management fee (covered by the free zonal-cluster credit)', 0],
      ['2 × e2-standard-4 on-demand (4 vCPU, 16 GB each)', 226],
      ['2 × 50 GB disks', 11],
      ['Load balancer', 18]
    ],
    specs: { kubernetes: 'GKE Standard, zonal', capacity: '8 vCPU · 32 GB', nodes: '2 (up to 3)' },
    runs: ['Everything in the cluster: services, MinIO storage, Redis, judge, voice', 'ingress-nginx load balancer'],
    reliability: 'No interruptions; a node failure is absorbed by the other node',
    scaling: 'Autoscales 2 → 3 nodes',
    limitations: ['Single zone: a zone outage takes the site down', 'Storage (MinIO) lives on one node\'s disk'],
    bestFor: 'Production on a ~$300 GCP budget',
    setupMinutes: 20,
    cfg: { locationType: 'zonal', zone: 'asia-south1-a', region: 'asia-south1', machineType: 'e2-standard-4', nodes: '2', spot: 'no' }
  },
  {
    id: 'gcp-production',
    provider: 'gcp',
    name: 'GKE Production',
    tagline: 'Regional GKE across three zones',
    monthly: 465,
    breakdown: [
      ['GKE management fee (regional)', 73],
      ['3 × e2-standard-4 (one per zone)', 340],
      ['3 × 100 GB disks', 34],
      ['Load balancer', 18]
    ],
    specs: { kubernetes: 'GKE Standard, regional', capacity: '12 vCPU · 48 GB', nodes: '3 (up to 12)' },
    runs: ['Everything in the cluster, spread over three zones', 'ingress-nginx load balancer'],
    reliability: 'Survives a node or a whole zone failing',
    scaling: 'Autoscales 1 → 4 nodes per zone',
    limitations: ['Cost', 'Storage (MinIO) is still one volume in one zone'],
    bestFor: 'High availability on GCP',
    setupMinutes: 25,
    cfg: { locationType: 'regional', region: 'asia-south1', machineType: 'e2-standard-4', nodes: '1', spot: 'no' }
  },

  /* ------------------------------------------------------------------ Azure */
  {
    id: 'azure-spot',
    provider: 'azure',
    name: 'AKS Spot',
    tagline: 'Free AKS control plane, app on a spot node',
    monthly: 101,
    breakdown: [
      ['AKS control plane (Free tier)', 0],
      ['System node: 1 × Standard_B2s (2 vCPU, 4 GB)', 30],
      ['App node: 1 × Standard_D4as_v5 spot (4 vCPU, 16 GB)', 26],
      ['2 × OS disks', 20],
      ['Load balancer + public IP', 25]
    ],
    specs: { kubernetes: 'AKS, Free tier', capacity: '4 vCPU · 16 GB (spot) + 2 vCPU · 4 GB (system)', nodes: '2' },
    runs: ['App pods on the spot node, Kubernetes system pods on the small node', 'MinIO, Redis, judge, voice in the cluster'],
    reliability: 'Spot node can be evicted; the app is down until a new spot node starts',
    scaling: 'Spot pool autoscales 1 → 2',
    limitations: ['Spot evictions', 'Free tier has no uptime SLA', 'The small system node cannot host the whole app'],
    bestFor: 'Cheapest Kubernetes on Azure; staging',
    setupMinutes: 20,
    cfg: { location: 'centralindia', systemSize: 'Standard_B2s', nodeSize: 'Standard_D4as_v5', nodeCount: '1', spot: 'yes', tier: 'free' }
  },
  {
    id: 'azure-budget',
    provider: 'azure',
    name: 'AKS Budget',
    tagline: 'Free AKS control plane, one steady node',
    monthly: 161,
    breakdown: [
      ['AKS control plane (Free tier)', 0],
      ['1 × Standard_D4as_v5 (4 vCPU, 16 GB)', 126],
      ['OS disk', 10],
      ['Load balancer + public IP', 25]
    ],
    specs: { kubernetes: 'AKS, Free tier', capacity: '4 vCPU · 16 GB', nodes: '1 (up to 2)' },
    runs: ['Everything in the cluster: services, MinIO, Redis, judge, voice'],
    reliability: 'No interruptions; one node means downtime if it fails',
    scaling: 'Autoscales 1 → 2 nodes',
    limitations: ['Single node', 'Free tier has no uptime SLA'],
    bestFor: 'Small production on Azure',
    setupMinutes: 20,
    cfg: { location: 'centralindia', nodeSize: 'Standard_D4as_v5', nodeCount: '1', spot: 'no', tier: 'free' }
  },
  {
    id: 'azure-production',
    provider: 'azure',
    name: 'AKS Production',
    tagline: 'SLA-backed AKS with two nodes',
    monthly: 398,
    breakdown: [
      ['AKS control plane (Standard tier, uptime SLA)', 73],
      ['2 × Standard_D4s_v5 (4 vCPU, 16 GB each)', 280],
      ['2 × OS disks', 20],
      ['Load balancer + public IP', 25]
    ],
    specs: { kubernetes: 'AKS, Standard tier', capacity: '8 vCPU · 32 GB', nodes: '2 (up to 4)' },
    runs: ['Everything in the cluster', 'ingress-nginx load balancer'],
    reliability: 'Financially backed SLA; survives a node failure',
    scaling: 'Autoscales 2 → 4 nodes',
    limitations: ['Cost', 'Storage (MinIO) is one volume on one node'],
    bestFor: 'Production on Azure',
    setupMinutes: 25,
    cfg: { location: 'centralindia', nodeSize: 'Standard_D4s_v5', nodeCount: '2', spot: 'no', tier: 'standard' }
  },

  /* ------------------------------------------------------------------ local */
  {
    id: 'local',
    provider: 'local',
    name: 'Local cluster',
    tagline: 'Docker Desktop or kind on this machine',
    monthly: 0,
    breakdown: [['Your machine', 0]],
    specs: { kubernetes: 'Docker Desktop / kind', capacity: 'This machine', nodes: '1+' },
    runs: ['Everything in the cluster, reachable at localhost'],
    reliability: 'Only while this machine is on',
    scaling: 'None',
    limitations: ['Not reachable from the internet', 'Uses this machine\'s memory'],
    bestFor: 'Trying deploys, rollbacks and logs before paying for a cloud',
    setupMinutes: 10,
    cfg: { kubeContext: 'docker-desktop', publicUrl: 'http://localhost:3000' }
  }
];
