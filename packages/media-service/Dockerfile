# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json ./
COPY packages/shared ./packages/shared
COPY packages/media-service ./packages/media-service
RUN pnpm install
RUN pnpm --filter @lms/media-service build

# --- runtime stage ---
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/packages/media-service/dist ./dist
COPY --from=build /app/packages/media-service/node_modules ./node_modules
COPY --from=build /app/packages/shared ./node_modules/@lms/shared
EXPOSE 5003
CMD ["node", "dist/server.js"]
