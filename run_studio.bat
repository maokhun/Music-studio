@echo off
title CamMusic AI - Khmer & Global Music Studio
cd /d "%~dp0"
echo ================================================================
echo   CamMusic AI - Khmer ^& Global AI Music Studio
echo   Auto-Pilot Bridge + Web Studio Launching...
echo ================================================================
echo.

:: ---- Check and free port 3000 if something else is using it ----
echo [1/4] Checking and freeing port 3000...
powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue; if ($c) { $c | ForEach-Object { taskkill /PID $_.OwningProcess /T /F >$null 2>&1 } }"
timeout /t 1 /nobreak >nul
echo      Port 3000 is ready.

:: ---- Check and free port 4000 if something else is using it ----
echo [2/4] Checking and freeing port 4000...
powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue; if ($c) { $c | ForEach-Object { taskkill /PID $_.OwningProcess /T /F >$null 2>&1 } }"
timeout /t 1 /nobreak >nul
echo      Port 4000 is ready.

echo.

:: ---- Start Auto-Pilot Bridge on port 4000 in background ----
echo [3/4] Starting Auto-Pilot Bridge on port 4000...
start /min cmd /c "python suno_autopilot_bridge.py"
timeout /t 1 /nobreak >nul
echo      Auto-Pilot Bridge started!

echo.

:: ---- Start Next.js Studio and wait for it before opening browser ----
echo [4/4] Starting CamMusic AI Studio on port 3000...
echo      Please wait while the server loads...
echo.

:: Start Next.js in background first
start /min cmd /k "cd /d "%~dp0" && npm start"

:: Wait for port 3000 to become available (up to 30 seconds)
set /a WAIT=0
:WAIT_LOOP
netstat -aon | findstr ":3000 " >nul 2>&1
if %errorlevel%==0 goto READY
set /a WAIT+=1
if %WAIT% GEQ 30 goto TIMEOUT
echo      Waiting for server... (%WAIT%s)
timeout /t 1 /nobreak >nul
goto WAIT_LOOP

:READY
echo.
echo ================================================================
echo   Studio is READY!  Opening browser now...
echo ================================================================
start "" "http://localhost:3000"
echo.
echo   Press any key to stop the studio, or just close this window.
pause >nul
goto END

:TIMEOUT
echo.
echo   WARNING: Server took too long to start.
echo   Opening browser anyway - you may need to refresh after it loads.
start "" "http://localhost:3000"
pause

:END
