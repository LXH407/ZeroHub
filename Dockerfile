# ============================================================
# ZeroHub — 腾讯云 CloudBase 云托管 Dockerfile（glibc Debian 稳定版，避免 musl/better-sqlite3 coredump）
# 功能：构建 admin-web dist → 安装 server 依赖 → 启动 ZeroHub
# 版本：commit-31b55f4-fix-cloudbase-coredump
# ============================================================

FROM node:20-bookworm-slim AS builder
LABEL stage=zerohub-builder

# --- Stage 1: 构建 admin-web 静态资源（管理后台 /admin 页面）---
WORKDIR /app/admin-web
ENV NODE_ENV=production
# 信任 GitHub / npm 源（国内 npm 镜像加速可选，CloudBase 海外源一般够）
RUN npm config set fund false && npm config set audit false
COPY admin-web/package*.json ./
# 无 package-lock 时用 npm install，保留 npm ci 优先
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund --no-package-lock; fi
COPY admin-web/ ./
RUN npm run build \
    && du -sh dist | awk '{printf "✅ admin-web dist 构建完成，大小=%s\n",$1}'

# --- Stage 2: 安装 server 生产依赖（better-sqlite3 优先 prebuilt glibc，musl Alpine 换 Debian 就不用 --build-from-source）---
FROM node:20-bookworm-slim AS server-deps
LABEL stage=zerohub-server-deps
WORKDIR /app/server
ENV NODE_ENV=production
# better-sqlite3 预编译包（glibc x86_64）如果下载失败才需要 build-essential python3 源码编 → 全装上保底
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends build-essential python3 ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* \
 && npm config set fund false && npm config set audit false
COPY server/package*.json ./
# --omit=dev 生产依赖；不强制 --build-from-source，better-sqlite3 v13 会先尝试 glibc prebuilt（Debian 能直接用 99%，避免源码编译 OOM）
RUN (npm ci --omit=dev --no-audit --no-fund 2>&1 || npm install --omit=dev --no-audit --no-fund 2>&1) | tail -n 20 \
 && node -e "try{const bs=require('better-sqlite3');console.log('✅ server-deps better-sqlite3 加载成功, 原生模块=', Object.keys(bs).slice(0,5).join(','));}catch(e){console.error('❌ FATAL better-sqlite3 加载失败：',e.message);process.exit(1);}"

# --- Stage 3: Runtime（Debian glibc slim，生产运行层，稳定不 coredump）---
FROM node:20-bookworm-slim AS runtime
LABEL org.opencontainers.image.title="ZeroHub (CloudBase CloudRun / Debian stable)" \
      org.opencontainers.image.description="ZeroHub 软件商城（腾讯云 CloudBase 云托管稳定版：glibc Debian 20 + prebuilt better-sqlite3 v13 + tini）" \
      maintainer="ZeroHub Team"

# tini 作为 PID 1 优雅处理 SIGTERM/SIGINT，防止 better-sqlite3 WAL 写坏；ca-certificates 防止 HTTPS 请求镜像源 TLS 失败；libstdc++6 原生模块依赖
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends tini ca-certificates libstdc++6 procps \
 && rm -rf /var/lib/apt/lists/* \
 && node --version | awk '{print "✅ 运行时 Node 版本="$0}'

WORKDIR /app

# --- 拷贝 admin-web 构建产物 ---
COPY --from=builder /app/admin-web/dist   ./admin-web/dist
COPY admin-web/public                    ./admin-web/public

# --- 拷贝 server 源码 + 生产 node_modules（来自 server-deps 阶段 glibc prebuilt 成功的版本）---
COPY --from=server-deps /app/server/node_modules  ./server/node_modules
COPY server/db          ./server/db
COPY server/middleware  ./server/middleware
COPY server/routes      ./server/routes
COPY server/public      ./server/public
COPY server/uploads     ./server/uploads
COPY server/*.js        ./server/
COPY server/package*.json ./server/

# --- deploy / 文档 拷贝到根（非必须）---
COPY deploy/             ./deploy/
COPY DEPLOY.md AI_PROMPT.md render.yaml package.json ./

# --- 环境变量 ---
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
# JWT_SECRET 通过 CloudBase 控制台环境变量 / 密钥管理覆盖，这里兜底仅临时
ENV JWT_SECRET=${JWT_SECRET:-zerohub-cloudbase-debian-default-please-override-me}

# SQLite 数据目录：路线 A（本地盘）容器重启会丢；路线 B（CFS）挂载到 /app/server/data 持久
ENV DB_PATH=/app/server/data/zerohub.db
RUN mkdir -p /app/server/data /app/server/uploads \
 && touch /app/server/uploads/.gitkeep \
 && chown -R node:node /app \
 && ls -la /app/server/data /app/server/uploads | awk '{print "   "$0}'

EXPOSE 3000
USER node

# ===============================================
# ✅ 启动前 preflight 健康检查（显式报错代替 Coredump encountered）
# 1. 验证 better-sqlite3 能否正常 require（Node 不会 coredump，会打印清晰栈）
# 2. 验证 admin-web/dist 存在（管理后台不会 404）
# 3. 通过后才启动 server.js
# ===============================================
ENV PREFLIGHT="\
try{\
  require('fs').accessSync('/app/admin-web/dist/index.html');\
  console.log('[preflight] admin-web/dist/index.html OK');\
  const bs = require('/app/server/node_modules/better-sqlite3');\
  console.log('[preflight] better-sqlite3 require OK (glibc Debian stable)');\
  console.log('[preflight] 全部通过，启动 ZeroHub 后端服务 ...');\
}catch(e){\
  console.error('[preflight] FATAL 启动前检查失败：');\
  console.error(e && e.stack || e);\
  process.exit(2);\
}"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "cd /app/server && node -e \"$PREFLIGHT\" && exec node server.js"]
