# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@11.5.2
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/frontend ./packages/frontend
RUN pnpm install --ignore-scripts
RUN pnpm --filter @lms/shared build
# Monaco (the code editor) needs more than the default heap to bundle
RUN NODE_OPTIONS=--max-old-space-size=4096 pnpm --filter @lms/frontend build

# --- runtime stage ---
FROM nginx:alpine
COPY --from=build /app/packages/frontend/dist /usr/share/nginx/html
# rendered at start by the image's envsubst entrypoint (only ${NGINX_*} variables are set)
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY packages/frontend/nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
