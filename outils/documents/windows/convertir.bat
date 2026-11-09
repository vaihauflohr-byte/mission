@echo off
chcp 65001 > nul
title Mission - documents en PDF
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0convertir.ps1"
