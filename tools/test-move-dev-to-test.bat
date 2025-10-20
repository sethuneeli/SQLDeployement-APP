@echo off
setlocal
set NAME=%1
set SCHEMA=%2
if "%NAME%"=="" (
  echo Usage: %~n0 ^<ObjectName^> [Schema]
  echo Example: %~n0 Customers Sales
  exit /b 1
)
if "%SCHEMA%"=="" set SCHEMA=dbo
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0test-move-dev-to-test.ps1" -Name "%NAME%" -Schema "%SCHEMA%"
endlocal
