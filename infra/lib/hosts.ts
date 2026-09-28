// Boot scripts for the two EC2 hosts. Both install a systemd unit, so a reboot brings everything
// back (containers, config and firewall rules), not just the first boot.

// Judge host: the sandboxed code runner (bubblewrap inside the container needs seccomp/apparmor
// unconfined, which is why it lives on its own instance and not on the EKS nodes) plus the
// allowlisting registry proxy. The judge container may talk to the proxy and nothing else.
export function judgeBootScript(o: { image: string; registry: string; region: string }) {
  return `#!/bin/bash
set -euxo pipefail
dnf install -y docker
systemctl enable --now docker

cat > /usr/local/bin/judge-up.sh <<'SCRIPT'
#!/bin/bash
set -euo pipefail
IMAGE='${o.image}'
aws ecr get-login-password --region '${o.region}' | docker login --username AWS --password-stdin '${o.registry}'
docker pull "$IMAGE"
docker network inspect judge-net >/dev/null 2>&1 || docker network create --subnet 172.30.0.0/24 judge-net
docker rm -f registry-proxy judge >/dev/null 2>&1 || true

# allowlisting HTTPS proxy for npm / PyPI / Maven / Go: the only way out for dependency fetches
docker run -d --name registry-proxy --restart unless-stopped \\
  --network judge-net --ip 172.30.0.3 \\
  --user 1000 --read-only --cap-drop ALL --security-opt no-new-privileges \\
  -e PROXY_PORT=3128 "$IMAGE" node proxy.mjs

# the judge: every run gets its own bubblewrap sandbox with no network at all
docker run -d --name judge --restart unless-stopped \\
  --network judge-net --ip 172.30.0.2 -p 5010:5010 \\
  --user 1000 --cap-drop ALL --security-opt no-new-privileges \\
  --security-opt seccomp=unconfined --security-opt apparmor=unconfined \\
  --memory 6g --cpus 4 \\
  -e JUDGE_CONCURRENCY=4 -e PROJECT_CONCURRENCY=1 \\
  -e REGISTRY_PROXY=http://172.30.0.3:3128 \\
  -e JUDGE_CACHE_DIR=/var/cache/judge -v judge-cache:/var/cache/judge \\
  "$IMAGE"

# egress for the judge container: replies, and the registry proxy; everything else is dropped
iptables -N JUDGE-EGRESS 2>/dev/null || iptables -F JUDGE-EGRESS
iptables -A JUDGE-EGRESS -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
iptables -A JUDGE-EGRESS -d 172.30.0.3 -p tcp --dport 3128 -j RETURN
iptables -A JUDGE-EGRESS -j DROP
iptables -C DOCKER-USER -s 172.30.0.2 -j JUDGE-EGRESS 2>/dev/null || iptables -I DOCKER-USER -s 172.30.0.2 -j JUDGE-EGRESS
SCRIPT
chmod +x /usr/local/bin/judge-up.sh

cat > /etc/systemd/system/judge.service <<'UNIT'
[Unit]
Description=Knowhere judge + registry proxy
After=docker.service network-online.target
Requires=docker.service
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/bin/judge-up.sh
Restart=on-failure
RestartSec=15
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now judge.service
`;
}

// LiveKit host: the voice SFU on the host network (WebRTC needs the UDP range on a public IP),
// and Caddy terminating TLS for wss://<voiceDomain> when a domain is configured.
export function livekitBootScript(o: {
  region: string;
  secretArn: string;
  publicIp: string;
  voiceDomain?: string;
}) {
  const caddy = o.voiceDomain
    ? `
mkdir -p /etc/caddy
cat > /etc/caddy/Caddyfile <<'CADDY'
${o.voiceDomain} {
  reverse_proxy 127.0.0.1:7880
}
CADDY
docker rm -f caddy >/dev/null 2>&1 || true
docker run -d --name caddy --restart unless-stopped --network host \\
  -v /etc/caddy/Caddyfile:/etc/caddy/Caddyfile:ro -v caddy-data:/data caddy:2`
    : '';
  return `#!/bin/bash
set -euxo pipefail
dnf install -y docker jq
systemctl enable --now docker

cat > /usr/local/bin/livekit-up.sh <<'SCRIPT'
#!/bin/bash
set -euo pipefail
# the API key/secret live in Secrets Manager; chat-service signs voice tokens with the same pair
SECRET=$(aws secretsmanager get-secret-value --region '${o.region}' --secret-id '${o.secretArn}' --query SecretString --output text)
KEY=$(echo "$SECRET" | jq -r .LIVEKIT_API_KEY)
VALUE=$(echo "$SECRET" | jq -r .LIVEKIT_API_SECRET)
mkdir -p /etc/livekit
umask 077
cat > /etc/livekit/livekit.yaml <<CONFIG
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  node_ip: ${o.publicIp}
keys:
  $KEY: $VALUE
CONFIG
docker rm -f livekit >/dev/null 2>&1 || true
docker run -d --name livekit --restart unless-stopped --network host \\
  -v /etc/livekit/livekit.yaml:/livekit.yaml:ro livekit/livekit-server:v1.13 --config /livekit.yaml
${caddy}
SCRIPT
chmod +x /usr/local/bin/livekit-up.sh

cat > /etc/systemd/system/livekit.service <<'UNIT'
[Unit]
Description=Knowhere LiveKit voice server
After=docker.service network-online.target
Requires=docker.service
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/bin/livekit-up.sh
Restart=on-failure
RestartSec=15
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now livekit.service
`;
}
