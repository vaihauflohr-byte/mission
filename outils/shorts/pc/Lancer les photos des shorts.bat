@echo off
chcp 65001 >nul
title Photos des shorts - mission.ka-ilei.com
cd /d "%~dp0"
py "%~dp0generer_photos.py"
if errorlevel 9009 python "%~dp0generer_photos.py"
echo.
pause
