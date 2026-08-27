# ============================================================
# ZeroHub — 腾讯云 CloudBase 云托管 Dockerfile
# 功能：构建 admin-web dist → 安装 server 依赖 → 启动 ZeroHub
# 数据库：better-sqlite3（zerohub.db 放持久卷，见 cloudbaserc.json volumeMounts）
# ============================================================

FROM node:20-alpine AS builder

# --- Stage 1: 构建 admin-web 静态资源（管理后台 /admin 页面）---
WORKDIR /app/admin-web
COPY admin-web/package*.json ./
RUN npm ci || npm install --no-audit --no-fund

COPY admin-web/ ./
RUN npm run build \
    && echo "✅ admin-web dist 构建完成（大小: $(du -sh dist | cut -f1)）"

# --- Stage 2: 安装 server 生产依赖（better-sqlite3 + express 等）---
FROM node:20-alpine AS server-deps
WORKDIR /app/server
# better-sqlite3 v13 原生编译需要 build-base + python3
RUN apk add --no-cache build-base python3 linux-headers
COPY server/package*.json ./
RUN npm ci --omit=dev --build-from-source || npm install --omit=dev --build-from-source --no-audit --no-fund \
    && echo "✅ server 生产依赖安装完成（better-sqlite3 原生编译成功）"

# --- Stage 3: Runtime（生产运行层，最小体积）---
FROM node:20-alpine AS runtime
LABEL org.opencontainers.image.title="ZeroHub (CloudBase CloudRun)" \
      org.opencontainers.image.description="ZeroHub 软件商城（腾讯云 CloudBase 云托管版）" \
      maintainer="ZeroHub Team"

# better-sqlite3 需要 libgcc / libstdc++（alpine 原生编译共享库）
RUN apk add --no-cache libgcc libstdc++ tini

WORKDIR /app

# 拷贝 admin-web 构建产物
COPY --from=builder /app/admin-web/dist   ./admin-web/dist
COPY admin-web/public                    ./admin-web/public 2>/dev/null || true

# 拷贝 server 源码 + 生产 node_modules
COPY --from=server-deps /app/server/node_modules  ./server/node_modules
COPY server/db          ./server/db
COPY server/middleware  ./server/middleware
COPY server/routes      ./server/routes
COPY server/public      ./server/public
COPY server/uploads     ./server/uploads
COPY server/*.js        ./server/
COPY server/package*.json ./server/

# deploy / AI_PROMPT / DEPLOY / render.yaml 拷贝到根方便用户查看（非必须）
COPY deploy/             ./deploy/ 2>/dev/null || true
COPY DEPLOY.md AI_PROMPT.md render.yaml package.json ./ 2>/dev/null || true

# --- 环境变量（CloudBase 通过 cloudbaserc.json 注入，这里给默认兜底）---
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
# JWT_SECRET 通过 CloudBase 控制台环境变量/密钥管理注入，默认值兜底（仅开发用）
ENV JWT_SECRET=${JWT_SECRET:-zerohub-cloudbase-default-please-override-me}

# SQLite 数据目录（必须挂持久卷！否则容器重启卡密/用户/资源全部丢失）
# 挂载点：/app/server/data  —— 对应 cloudbaserc.json volumeMounts.mountPath
ENV DB_PATH=/app/server/data/zerohub.db
RUN mkdir -p /app/server/data /app/server/uploads && \
    touch /app/server/uploads/.gitkeep && \
    chown -R node:node /app

# CloudBase 云托管健康检查必须的端口
EXPOSE 3000

USER node

# tini 处理 SIGTERM（Node 优雅关机），防止 better-sqlite3 WAL 损坏
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "cd /app/server && node server.js"]
