#!/usr/bin/env bash
# 影刀 RPA 控制台 — Linux/Mac 停止脚本
# 按端口 18923 精确结束服务进程
set -e

cd "$(dirname "$0")"

PORT="${PORT:-18923}"

if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti :"$PORT" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "正在停止监听 $PORT 的进程: $PIDS"
    kill $PIDS 2>/dev/null || true
    sleep 1
    # 若仍未退出，强制结束
    for p in $PIDS; do
      if kill -0 "$p" 2>/dev/null; then
        kill -9 "$p" 2>/dev/null || true
      fi
    done
    echo "服务已停止。"
  else
    echo "端口 $PORT 无监听进程，服务未在运行。"
  fi
else
  echo "未找到 lsof，请手动结束：pkill -f 'node server.js'"
fi
