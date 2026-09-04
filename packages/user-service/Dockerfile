# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@11.5.2
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/user-service ./packages/user-service
RUN pnpm install --ignore-scripts
RUN pnpm --filter @lms/shared build
RUN pnpm --filter @lms/user-service build
RUN pnpm --filter @lms/user-service deploy --legacy /prod/user-service --prod --ignore-scripts

# --- runtime stage ---
FROM node:22-alpine
WORKDIR /app
COPY --from=build /prod/user-service ./
EXPOSE 5001
CMD ["node", "dist/server.js"]
