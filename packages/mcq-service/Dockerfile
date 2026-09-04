# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json ./
COPY packages/shared ./packages/shared
COPY packages/mcq-service ./packages/mcq-service
RUN pnpm install
RUN pnpm --filter @lms/mcq-service build

# --- runtime stage ---
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/packages/mcq-service/dist ./dist
COPY --from=build /app/packages/mcq-service/node_modules ./node_modules
COPY --from=build /app/packages/shared ./node_modules/@lms/shared
EXPOSE 5004
CMD ["node", "dist/server.js"]
