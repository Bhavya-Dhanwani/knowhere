# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@11.5.2
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/coding-service ./packages/coding-service
RUN pnpm install --ignore-scripts
RUN pnpm --filter @lms/shared build
RUN pnpm --filter @lms/coding-service build
RUN pnpm --filter @lms/coding-service deploy --legacy /prod/coding-service --prod --ignore-scripts

# --- runtime stage ---
FROM node:22-alpine
WORKDIR /app
COPY --from=build /prod/coding-service ./
EXPOSE 5005
CMD ["node", "dist/server.js"]
