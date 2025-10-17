@echo off
setlocal enabledelayedexpansion

if "%~3"=="" (
  echo Usage: %~nx0 TYPE SCHEMA NAME [--auto-create]
  echo   TYPE: TABLE^|VIEW^|PROCEDURE^|FUNCTION^|TRIGGER^|INDEX
  echo   Example: %~nx0 TABLE MA Customers --auto-create
  exit /b 1
)

set TYPE=%~1
set SCHEMA=%~2
set NAME=%~3
set AUTOCREATE=
if /i "%~4"=="--auto-create" set AUTOCREATE=-AutoCreateSchemas

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0move-object-dev-to-test.ps1" -Type "%TYPE%" -Schema "%SCHEMA%" -Name "%NAME%" %AUTOCREATE%
