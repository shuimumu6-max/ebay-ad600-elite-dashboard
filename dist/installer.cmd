@echo off
rem ============================================================
rem  eBay Report Toolkit - installer launcher
rem  IMPORTANT: keep this file pure ASCII. Chinese text in a .cmd
rem  file breaks cmd.exe parsing on some locales (mojibake commands).
rem  All Chinese messages come from setup.ps1 (UTF-8 with BOM).
rem  Usage: double-click, or `installer.cmd /quiet` for automation.
rem ============================================================
setlocal
title eBay Report Toolkit - Setup
set "BASE=https://shuimumu6-max.github.io/ebay-ad600-elite-dashboard/dist/"
set "PS=%TEMP%\ebay-setup.ps1"
set "QUIET="
if /i "%~1"=="/quiet" set "QUIET=-Quiet"

where curl.exe >nul 2>nul
if errorlevel 1 goto nocurl

if exist "%PS%" del /q "%PS%" >nul 2>nul
curl.exe -L --fail --retry 2 --retry-delay 2 --connect-timeout 20 -s -S -o "%PS%" "%BASE%setup.ps1"
if errorlevel 1 goto dlfail
if not exist "%PS%" goto dlfail

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS%" %QUIET%
set "RC=%ERRORLEVEL%"
if "%RC%"=="0" goto ok

echo.
echo   [X] Setup failed (code %RC%).
echo       Log file: %TEMP%\ebay-install-log.txt
echo       Send that log to your administrator if it keeps failing.
if not defined QUIET pause
exit /b 1

:ok
if not defined QUIET (
  echo.
  echo   Done. You can close this window.
  pause >nul
)
exit /b 0

:nocurl
echo.
echo   [X] curl.exe not found - Windows 10 1809 or newer is required.
echo       Alternative: ask your administrator for the offline zip package.
if not defined QUIET pause
exit /b 1

:dlfail
echo.
echo   [X] Cannot download the setup script.
echo       URL: %BASE%setup.ps1
echo       Check network / proxy (corporate networks often block github.io),
echo       then run this file again.
if not defined QUIET pause
exit /b 1
