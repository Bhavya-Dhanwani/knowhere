# Multi-arch sandboxed runner for Python, C++ and Java submissions, plus whole-project build +
# test (/project): make/cmake/gcc/g++ (+ GoogleTest, Catch2, doctest), javac/Maven, python/pytest,
# node/npm, go, cargo, and a MongoDB server for tests. Dependencies are fetched only through the
# registry proxy (proxy.mjs, same image, own pod); builds and tests run with no network.
# Runs as a non-root user with no capabilities. bubblewrap builds each run's sandbox from
# unprivileged user namespaces, which the default seccomp/AppArmor profiles block, so the
# container needs seccomp=unconfined + apparmor=unconfined (never `privileged`).
FROM node:22-bookworm-slim
ARG TARGETARCH
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini bubblewrap util-linux python3 g++ openjdk-17-jdk-headless \
    make cmake python3-pytest python3-pip golang-go rustc cargo maven \
    libgtest-dev libgmock-dev catch2 doctest-dev \
    ca-certificates curl libcurl4 \
 # mongod only (for tests of MERN/Python apps; runs inside the offline sandbox on localhost)
 && case "$TARGETARCH" in \
      amd64) MONGO=mongodb-linux-x86_64-debian12-7.0.14 ;; \
      arm64) MONGO=mongodb-linux-aarch64-ubuntu2204-7.0.14 ;; \
      *) echo "unsupported arch $TARGETARCH" && exit 1 ;; \
    esac \
 && curl -fsSL "https://fastdl.mongodb.org/linux/$MONGO.tgz" | tar -xz -C /tmp \
 && install -m 0755 "/tmp/$MONGO/bin/mongod" /usr/local/bin/mongod \
 && rm -rf "/tmp/$MONGO" /var/lib/apt/lists/*
WORKDIR /app
COPY packages/judge-runner/server.mjs packages/judge-runner/proxy.mjs ./
ENV PORT=5010
EXPOSE 5010
USER node
# tini as PID 1 reaps the sandboxes killed on timeout; node as PID 1 would leave them as
# zombies until the container runs out of PIDs
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.mjs"]
