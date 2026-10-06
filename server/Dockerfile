# Build context: the repo root (the API compiles ../shared too). Coolify: base dir "/", Dockerfile "server/Dockerfile".
FROM node:22-alpine AS build
WORKDIR /src
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci
COPY shared ./shared
COPY server ./server
RUN cd server && npx prisma generate && npx nest build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# dist/shared resolves its deps (zod) from /app/node_modules.
COPY --from=build /src/server/dist ./dist
COPY server/prisma ./prisma
COPY server/prisma.config.ts ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server/src/main.js"]
