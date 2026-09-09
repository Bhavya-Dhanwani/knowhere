FROM node:22-alpine
WORKDIR /runner
COPY packages/code-runner-service/server.mjs ./server.mjs
USER node
EXPOSE 7001
CMD ["node", "server.mjs"]
