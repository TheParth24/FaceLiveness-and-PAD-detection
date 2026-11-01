@echo off
title FaceLivenessPAD Launcher
echo ==========================================================
echo   Launching FaceLivenessPAD Platform (Backend + Frontend)
echo ==========================================================

cd /d "%~dp0"

echo [1/2] Starting FastAPI Backend on http://127.0.0.1:8000...
start "FaceLivenessPAD - Backend" cmd /k ".\venv\Scripts\python.exe -m uvicorn server.main:app --host 127.0.0.1 --port 8000"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Next.js Frontend on http://localhost:3000...
start "FaceLivenessPAD - Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Platform successfully launched!
echo Opening browser to http://localhost:3000...
timeout /t 3 /nobreak >nul
start http://localhost:3000
