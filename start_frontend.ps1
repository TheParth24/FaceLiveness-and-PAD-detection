# PowerShell Script to Start FaceLivenessPAD Next.js Frontend
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Starting FaceLivenessPAD Next.js Web Platform        " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrontendDir = Join-Path $ScriptDir "frontend"
Set-Location $FrontendDir

Write-Host "[INFO] Starting Next.js development server on http://localhost:3000..." -ForegroundColor Green
Write-Host "[INFO] Press Ctrl+C to terminate the frontend dev server." -ForegroundColor Yellow
Write-Host ""

cmd /c "npm.cmd run dev"
