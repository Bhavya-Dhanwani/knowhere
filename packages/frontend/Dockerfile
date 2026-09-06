# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@11.5.2
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/frontend ./packages/frontend
RUN pnpm install --ignore-scripts
RUN pnpm --filter @lms/shared build
RUN pnpm --filter @lms/frontend build

# --- runtime stage ---
FROM nginx:alpine
COPY --from=build /app/packages/frontend/dist /usr/share/nginx/html
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
