@echo off
title OPERATOR: ZERO LINE - Tactical Multiplayer Server
echo =========================================================================
echo  OPERATOR: ZERO LINE - Tactical Multiplayer Top-Down Shooter
echo  Dynamic Fog of War - 2D Line of Sight - Real-time Room Multiplayer
echo =========================================================================
echo.
echo [1] Link Main di PC Master : http://localhost:3000
echo [2] Link Mabar 1 Wi-Fi/LAN : http://192.168.100.100:3000
echo.
echo Server aktif! Membuka game di browser Master...
cd /d "%~dp0"
start "" "http://localhost:3000"
node server.js
pause
