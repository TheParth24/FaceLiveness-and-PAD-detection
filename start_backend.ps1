# PowerShell Script to Start FaceLivenessPAD FastAPI Backend
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Starting FaceLivenessPAD Biometric Platform Backend   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$PythonExe = Join-Path $ScriptDir "venv\Scripts\python.exe"

if (-not (Test-Path $PythonExe)) {
    Write-Host "[ERROR] Virtual environment python.exe not found at $PythonExe" -ForegroundColor Red
    Write-Host "Please ensure Python 3.12 venv is initialized." -ForegroundColor Yellow
    Exit 1
}

Write-Host "[INFO] Using Python: $PythonExe" -ForegroundColor Green
Write-Host "[INFO] Starting FastAPI server on http://127.0.0.1:8000..." -ForegroundColor Green
Write-Host "[INFO] WebSocket telemetry available at ws://127.0.0.1:8000/ws/biometrics/{session_id}" -ForegroundColor Green
Write-Host ""

try {
    & $PythonExe -m uvicorn server.main:app --host 127.0.0.1 --port 8000
} catch {
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Backend process stopped. Press Enter to exit..." -ForegroundColor Yellow
[void][System.Console]::ReadLine()
