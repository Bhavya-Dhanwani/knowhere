# Multi-arch sandboxed runner for Python, C++ and Java submissions.
# Runs as a non-root user with no capabilities. bubblewrap builds each run's sandbox from
# unprivileged user namespaces, which the default seccomp/AppArmor profiles block, so the
# container needs seccomp=unconfined + apparmor=unconfined (never `privileged`).
FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends bubblewrap util-linux python3 g++ openjdk-17-jdk-headless \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY packages/judge-runner/server.mjs ./
ENV PORT=5010
EXPOSE 5010
USER node
CMD ["node", "server.mjs"]
