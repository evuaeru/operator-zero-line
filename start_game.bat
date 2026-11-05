@echo off
title OPERATOR: ZERO LINE - Tactical Multiplayer Server
echo =========================================================================
echo  OPERATOR: ZERO LINE - Tactical Multiplayer Top-Down Shooter
echo  Dynamic Fog of War - 2D Line of Sight - Real-time Room Multiplayer
echo =========================================================================
echo.
echo Launching server on http://localhost:3000 ...
cd /d "%~dp0"
start "" "http://localhost:3000"
node server.js
pause
