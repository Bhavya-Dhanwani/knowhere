# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@11.5.2
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/auth-service ./packages/auth-service
RUN pnpm install --ignore-scripts
RUN pnpm --filter @lms/shared build
RUN pnpm --filter @lms/auth-service build
RUN pnpm --filter @lms/auth-service deploy --legacy /prod/auth-service --prod --ignore-scripts

# --- runtime stage ---
FROM node:22-alpine
WORKDIR /app
COPY --from=build /prod/auth-service ./
EXPOSE 5000
CMD ["node", "dist/server.js"]
