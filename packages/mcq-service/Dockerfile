# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@11.5.2
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/mcq-service ./packages/mcq-service
RUN pnpm install --ignore-scripts
RUN pnpm --filter @lms/shared build
RUN pnpm --filter @lms/mcq-service build
RUN pnpm --filter @lms/mcq-service deploy --legacy /prod/mcq-service --prod --ignore-scripts

# --- runtime stage ---
FROM node:22-alpine
WORKDIR /app
COPY --from=build /prod/mcq-service ./
EXPOSE 5004
CMD ["node", "dist/server.js"]
