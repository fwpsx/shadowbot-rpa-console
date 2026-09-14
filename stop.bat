@echo off
chcp 936 >nul
setlocal enabledelayedexpansion
title 停止影刀 RPA 控制台服务

set "PORT=18923"
set "FOUND="

for /f "tokens=5" %%a in ('netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"') do (
    set "PID=%%a"
    echo 发现监听 %PORT% 端口的进程 PID=!PID!，正在结束...
    taskkill /F /PID !PID! >nul 2>&1
    if !errorlevel! equ 0 (
        echo 已停止进程 !PID!
    ) else (
        echo 结束进程 !PID! 失败，可能已停止或无权限。
    )
    set "FOUND=1"
)

if not defined FOUND (
    echo 端口 %PORT% 当前没有正在运行的服务。
)

echo.
pause
