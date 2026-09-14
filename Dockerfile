# ============================================================
# 影刀 RPA 控制台 — Docker 镜像（可选方案）
#
# ⚠️ 重要说明：
#   影刀 RPA 客户端（CLI 与本地 REST API 42500）运行在 Windows 宿主机上，
#   且仅监听 127.0.0.1。因此本控制台服务通常直接跑在 Windows 宿主机即可，
#   Docker 方式主要用于以下场景：
#     1. 在 Linux/Mac 上部署纯前端 + 远程调用（需额外桥接影刀 API）
#     2. 统一运行环境、简化分发
#   默认建议直接在 Windows 上用 start.bat 或 node server.js 运行。
# ============================================================

FROM node:20-alpine

WORKDIR /app

# 复制项目文件（不含 node_modules / .env / backups，见 .dockerignore）
COPY package.json ./
COPY server.js ./
COPY config.js ./
COPY lib/ ./lib/
COPY routes/ ./routes/
COPY public/ ./public/

# 暴露端口（可用 -e PORT=xxx 覆盖）
EXPOSE 18923

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||18923)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
