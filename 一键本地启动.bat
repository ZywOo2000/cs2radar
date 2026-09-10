@echo off
chcp 65001 >nul
setlocal

title 数据雷达图 - 本地服务器
cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装 Node.js 22 或更高版本。
  echo https://nodejs.org/
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 npm，请重新安装 Node.js。
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [准备] 首次运行，正在安装项目依赖……
  call npm.cmd install
  if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查网络连接和上方错误信息。
    pause
    exit /b 1
  )
)

powershell.exe -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 1 }"
if errorlevel 1 (
  echo [错误] 端口 3000 已被占用，请先关闭正在使用该端口的程序。
  pause
  exit /b 1
)

echo [启动] 本地网站地址：http://127.0.0.1:3000
echo [提示] 关闭本窗口或按 Ctrl+C 即可停止网站。

start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://127.0.0.1:3000'"
call npm.cmd run dev -- --hostname 127.0.0.1 --port 3000

echo.
echo 本地服务器已停止。
pause
endlocal
