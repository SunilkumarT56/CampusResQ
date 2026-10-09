FROM node:24-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci --workspace=@network-router/api --include-workspace-root
COPY apps/api apps/api
RUN npm run build --workspace=@network-router/api
FROM node:24-alpine
WORKDIR /app
COPY --from=build /workspace/apps/api/dist ./dist
COPY --from=build /workspace/apps/api/package.json .
COPY --from=build /workspace/node_modules ./node_modules
RUN addgroup -S app && adduser -S app -G app
USER app
ENV NODE_ENV=production
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
CMD ["node", "dist/main.js"]
