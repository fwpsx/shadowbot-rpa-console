@echo off
chcp 936 >nul
setlocal enabledelayedexpansion
title 影刀 RPA 控制台服务
cd /d "%~dp0"

rem ---------- 自动探测 Node.js ----------
set "NODE_CMD="

rem 1) 系统 PATH 中的 node（已安装到系统时）
where node >nul 2>&1
if not errorlevel 1 set "NODE_CMD=node"

rem 2) 常见安装目录（官方安装包 / winget / nvm-windows）
if not defined NODE_CMD if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_CMD=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_CMD if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_CMD=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE_CMD if exist "%LocalAppData%\Programs\nodejs\node.exe" set "NODE_CMD=%LocalAppData%\Programs\nodejs\node.exe"

rem 3) WorkBuddy 内置 node（取 versions 下目录里的 node.exe）
if not defined NODE_CMD (
    for /d %%d in ("%USERPROFILE%\.workbuddy\binaries\node\versions\*") do (
        if exist "%%d\node.exe" set "NODE_CMD=%%d\node.exe"
    )
)

if not defined NODE_CMD (
    echo [错误] 未找到 Node.js（需 ^>= 16）。
    echo 请安装 Node.js：https://nodejs.org/ 后重新运行本脚本。
    echo.
    pause
    exit /b 1
)

echo ============================================
echo   影刀 RPA 控制台服务
echo   Node: !NODE_CMD!
echo   端口: 18923    访问: http://127.0.0.1:18923
echo   停止服务请运行 stop.bat 或直接关闭本窗口
echo ============================================
echo.

"!NODE_CMD!" server.js

echo.
echo 服务已退出。
pause
