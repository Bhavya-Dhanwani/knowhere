# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@11.5.2
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/course-service ./packages/course-service
RUN pnpm install --ignore-scripts
RUN pnpm --filter @lms/shared build
RUN pnpm --filter @lms/course-service build
RUN pnpm --filter @lms/course-service deploy --legacy /prod/course-service --prod --ignore-scripts

# --- runtime stage ---
FROM node:22-alpine
# ffmpeg packages uploaded videos into encrypted HLS
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY --from=build /prod/course-service ./
EXPOSE 5002
CMD ["node", "dist/server.js"]
