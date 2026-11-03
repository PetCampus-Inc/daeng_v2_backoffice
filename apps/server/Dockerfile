# 빌드 컨텍스트는 저장소 루트다.
#   docker build -f apps/server/Dockerfile --target runtime -t daeng-bo-server .
#   docker build -f apps/server/Dockerfile --target migrate -t daeng-bo-migrate .
FROM node:24-slim AS base
ENV HUSKY=0
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api-spec/package.json packages/api-spec/package.json
RUN pnpm install --frozen-lockfile --filter @daeng/server...
COPY packages packages
COPY apps/server apps/server
RUN pnpm --filter @daeng/shared build && pnpm --filter @daeng/server build
RUN pnpm --filter @daeng/server deploy --prod --legacy /out

# 마이그레이션 전용. drizzle-kit이 devDependency라 빌드 단계 전체를 쓴다.
FROM build AS migrate
WORKDIR /repo/apps/server
CMD ["pnpm", "db:migrate"]

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
