FROM node:24-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json turbo.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace=@network-router/web --include-workspace-root
COPY apps/web apps/web
RUN npm run build --workspace=@network-router/web
FROM nginx:1.27-alpine
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/ || exit 1
