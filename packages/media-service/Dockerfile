# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@11.5.2
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/media-service ./packages/media-service
RUN pnpm install --ignore-scripts
RUN pnpm --filter @lms/shared build
RUN pnpm --filter @lms/media-service build
RUN pnpm --filter @lms/media-service deploy --legacy /prod/media-service --prod --ignore-scripts

# --- runtime stage ---
FROM node:22-alpine
WORKDIR /app
COPY --from=build /prod/media-service ./
EXPOSE 5003
CMD ["node", "dist/server.js"]
