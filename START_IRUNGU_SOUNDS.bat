@echo off
title IRUNGU SOUNDS Pro Common 2000

echo Starting IRUNGU SOUNDS...
echo This launcher works from any folder.
echo.

set APP_DIR=%~dp0

start "IRUNGU SOUNDS Backend" cmd /k "cd /d "%APP_DIR%server" && npm.cmd start"

timeout /t 3 >nul

start "IRUNGU SOUNDS Frontend" cmd /k "cd /d "%APP_DIR%" && npm.cmd run dev -- --host 127.0.0.1 --port 5174"

timeout /t 5 >nul

start http://127.0.0.1:5174

echo IRUNGU SOUNDS started.
echo Keep the two black windows open while using the tool.
pause
