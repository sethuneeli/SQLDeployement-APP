@echo off
echo === MUFO Tables Deployment (Quick Deploy) ===
echo.

REM Check if server is running
curl -s http://localhost:3000 >nul 2>&1
if errorlevel 1 (
    echo ❌ Server not running at http://localhost:3000
    echo Please start the application first with: node app.js
    pause
    exit /b 1
)

echo ✅ Server detected at http://localhost:3000
echo.

echo === Connecting to Environments ===
echo Connecting to DEV...
curl -s "http://localhost:3000/sql-connect/DEV" | findstr "success"
echo Connecting to TEST...  
curl -s "http://localhost:3000/sql-connect/TEST" | findstr "success"
echo.

echo === Quick Deployment Options ===
echo 1. Preview deployment (dry run)
echo 2. Execute deployment to TEST
echo 3. Execute deployment to LIVE
echo 4. Exit
echo.

set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" goto preview
if "%choice%"=="2" goto deploy_test
if "%choice%"=="3" goto deploy_live
if "%choice%"=="4" goto exit
goto menu

:preview
echo.
echo === Running Preview Mode ===
powershell -ExecutionPolicy Bypass -File "deploy_mufo_tables.ps1" -DryRun
goto end

:deploy_test
echo.
echo === Deploying to TEST Environment ===
powershell -ExecutionPolicy Bypass -File "deploy_mufo_tables.ps1" -TargetEnv "TEST" -Execute
goto end

:deploy_live
echo.
echo === Deploying to LIVE Environment ===
powershell -ExecutionPolicy Bypass -File "deploy_mufo_tables.ps1" -TargetEnv "LIVE" -Execute
goto end

:exit
echo Exiting...
goto end

:end
echo.
pause