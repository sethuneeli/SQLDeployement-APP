@echo off
setlocal
if "%~1"=="" (
  echo Usage: %~nx0 SCHEMA [--auto-create]
  exit /b 1
)
set SCHEMA=%~1
set AUTOCREATE=
if /i "%~2"=="--auto-create" set AUTOCREATE=-AutoCreateSchemas
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0move-schema.ps1" -FromEnv DEV -ToEnv TEST -Schema "%SCHEMA%" %AUTOCREATE%
