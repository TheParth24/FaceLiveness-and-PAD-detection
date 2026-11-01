# PowerShell Script to Launch Both FaceLivenessPAD Backend & Frontend
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Launching FaceLivenessPAD Platform (Backend + Web UI) " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start Backend in new process
Write-Host "[1/2] Launching FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-File", (Join-Path $ScriptDir "start_backend.ps1")

# Wait a moment for backend to initialize
Start-Sleep -Seconds 3

# Start Frontend in new process
Write-Host "[2/2] Launching Next.js Frontend on http://localhost:3000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-File", (Join-Path $ScriptDir "start_frontend.ps1")

Write-Host ""
Write-Host "Platform launched! Open your browser to:" -ForegroundColor Cyan
Write-Host "  Web Platform:    http://localhost:3000" -ForegroundColor Yellow
Write-Host "  Backend Swagger: http://127.0.0.1:8000/docs" -ForegroundColor Yellow
Write-Host ""
