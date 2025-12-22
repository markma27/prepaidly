# Prepaidly Backend Startup Script for Windows
# This script sets up the environment and starts the backend

Write-Host "=== Prepaidly Backend Startup ===" -ForegroundColor Cyan

# Set JAVA_HOME
$javaHome = "C:\Program Files\Eclipse Adoptium\jdk-21.0.9.10-hotspot"
if (Test-Path $javaHome) {
    $env:JAVA_HOME = $javaHome
    Write-Host "JAVA_HOME set to: $javaHome" -ForegroundColor Green
} else {
    Write-Host "Warning: Java installation not found at expected location" -ForegroundColor Yellow
    Write-Host "Please set JAVA_HOME manually" -ForegroundColor Yellow
}

# Refresh PATH to include Java
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')

# Check if application-local.properties exists
$configFile = "src\main\resources\application-local.properties"
if (-not (Test-Path $configFile)) {
    Write-Host "`nWarning: $configFile not found!" -ForegroundColor Yellow
    Write-Host "Please copy application-local.properties.example and configure it." -ForegroundColor Yellow
    Write-Host "Press any key to continue anyway, or Ctrl+C to cancel..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Navigate to backend directory
Set-Location $PSScriptRoot

# Start backend
Write-Host "`nStarting backend server..." -ForegroundColor Green
Write-Host "Backend will be available at: http://localhost:8080" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Gray

# Enable IPv6 support for Java (needed for Supabase connections)
$env:JAVA_OPTS = "-Djava.net.preferIPv6Addresses=true"

.\gradlew.bat bootRun --args='--spring.profiles.active=local'

