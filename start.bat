@echo off
chcp 936 >nul
title 影刀 RPA 控制台服务
cd /d "%~dp0"

echo ============================================
echo   影刀 RPA 控制台服务
echo   端口: 18923    访问: http://127.0.0.1:18923
echo   停止服务请运行 stop.bat 或直接关闭本窗口
echo ============================================
echo.

node server.js

echo.
echo 服务已退出。
pause
