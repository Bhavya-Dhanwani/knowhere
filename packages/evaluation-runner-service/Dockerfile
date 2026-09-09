FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git python3 python3-pip chromium \
  && pip3 install --break-system-packages --no-cache-dir semgrep schemathesis \
  && curl -fsSL https://raw.githubusercontent.com/gitleaks/gitleaks/master/scripts/install.sh | sh -s -- -b /usr/local/bin v8.28.0 \
  && curl -fsSL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin v0.66.0 \
  && npm install --global lighthouse@12.8.2 \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /root/.cache

WORKDIR /runner
COPY packages/evaluation-runner-service/server.mjs ./server.mjs

RUN useradd --create-home --uid 10001 runner && chown -R runner:runner /runner
USER runner
EXPOSE 7002
CMD ["node", "server.mjs"]
