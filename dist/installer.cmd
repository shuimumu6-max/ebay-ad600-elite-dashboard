@echo off
chcp 65001 >nul
setlocal
title eBay报表工具包 - 安装器
set "BASE=https://shuimumu6-max.github.io/ebay-ad600-elite-dashboard/dist/"
set "PS=%TEMP%\ebay-setup.ps1"

echo.
echo  即将安装 eBay 报表工具包到桌面「eBay报表工具包」文件夹。
echo  首次安装需下载约 83 MB 运行时，请保持网络畅通、别关窗口。
echo.

where curl.exe >nul 2>nul
if errorlevel 1 (
  echo [X] 系统缺少 curl.exe（Windows 10 1809 以上自带）。请用另一种方式：手动下载 toolkit.zip。
  goto done
)

curl.exe -L -s -o "%PS%" "%BASE%setup.ps1"
if errorlevel 1 (
  echo [X] 下载安装脚本失败，请检查网络（或把上面的报错截图发给管理员）。
  goto done
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS%"
if errorlevel 1 echo [X] 安装过程出错，请把上面的报错截图发给管理员。

:done
echo.
pause
