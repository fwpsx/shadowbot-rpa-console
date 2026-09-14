#!/usr/bin/env bash
# 影刀 RPA 控制台 — Linux/Mac 启动脚本
# 用法：./start.sh   （或 bash start.sh）
set -e

cd "$(dirname "$0")"

PORT="${PORT:-18923}"

# 检查 node
if ! command -v node >/dev/null 2>&1; then
  echo "错误：未检测到 Node.js，请先安装 Node.js ≥ 16"
  echo "下载：https://nodejs.org/"
  exit 1
fi

# 检查端口是否已被占用
if command -v lsof >/dev/null 2>&1; then
  if lsof -i :"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "警告：端口 $PORT 已被占用，服务可能已在运行。"
    echo "如需重启，请先运行 ./stop.sh"
    exit 1
  fi
fi

echo "============================================"
echo "  影刀 RPA 控制台服务"
echo "  端口: $PORT    访问: http://127.0.0.1:$PORT"
echo "  停止服务: Ctrl+C 或运行 ./stop.sh"
echo "============================================"
echo ""

exec node server.js
