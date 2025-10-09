# Deploy MUFO Tables from DEV to TEST via Command Line
# This script uses the SQL Deployment App API to migrate MUFO-related tables

param(
    [string]$ServerUrl = "http://localhost:3000",
    [string]$SourceEnv = "DEV", 
    [string]$TargetEnv = "TEST",
    [switch]$DryRun = $false,
    [switch]$Execute = $false
)

Write-Host "=== MUFO Tables Deployment Script ===" -ForegroundColor Cyan
Write-Host "Source Environment: $SourceEnv" -ForegroundColor Yellow
Write-Host "Target Environment: $TargetEnv" -ForegroundColor Yellow
Write-Host "Server URL: $ServerUrl" -ForegroundColor Yellow

# MUFO-related table objects to deploy
$MufoObjects = @(
    @{ schema = "dbo"; name = "NewMUFO_Quarter"; type = "TABLE" },
    @{ schema = "dbo"; name = "NewMUFO_Tracker"; type = "TABLE" },
    @{ schema = "dbo"; name = "GetnewMUFOTracker_UFOID"; type = "PROCEDURE" }
)

# Function to make API calls with error handling
function Invoke-DeploymentAPI {
    param(
        [string]$Endpoint,
        [hashtable]$Body,
        [string]$Method = "POST"
    )
    
    try {
        $jsonBody = $Body | ConvertTo-Json -Depth 10 -Compress
        $response = Invoke-RestMethod -Uri "$ServerUrl$Endpoint" -Method $Method -Body $jsonBody -ContentType "application/json" -ErrorAction Stop
        return $response
    }
    catch {
        Write-Error "API call failed: $($_.Exception.Message)"
        Write-Error "Response: $($_.ErrorDetails.Message)"
        return $null
    }
}

# Step 1: Connect to environments
Write-Host "`n=== Step 1: Connecting to Environments ===" -ForegroundColor Green

Write-Host "Connecting to $SourceEnv..." -ForegroundColor Yellow
$srcConnect = Invoke-RestMethod -Uri "$ServerUrl/sql-connect/$SourceEnv" -Method GET
if (-not $srcConnect.success) {
    Write-Error "Failed to connect to $SourceEnv`: $($srcConnect.message)"
    exit 1
}
Write-Host "✅ Connected to $SourceEnv" -ForegroundColor Green

Write-Host "Connecting to $TargetEnv..." -ForegroundColor Yellow  
$tgtConnect = Invoke-RestMethod -Uri "$ServerUrl/sql-connect/$TargetEnv" -Method GET
if (-not $tgtConnect.success) {
    Write-Error "Failed to connect to $TargetEnv`: $($tgtConnect.message)"
    exit 1
}
Write-Host "✅ Connected to $TargetEnv" -ForegroundColor Green

# Step 2: Generate implementation plan
Write-Host "`n=== Step 2: Generating Implementation Plan ===" -ForegroundColor Green

$diffBody = @{
    fromEnv = $SourceEnv
    toEnv = $TargetEnv  
    objects = $MufoObjects
}

Write-Host "Analyzing differences between $SourceEnv and $TargetEnv..." -ForegroundColor Yellow
$diffResponse = Invoke-DeploymentAPI -Endpoint "/ddl/diff" -Body $diffBody

if (-not $diffResponse -or -not $diffResponse.success) {
    Write-Error "Failed to generate diff plan"
    exit 1
}

Write-Host "✅ Diff analysis complete" -ForegroundColor Green

# Step 3: Display plan summary
Write-Host "`n=== Step 3: Deployment Plan Summary ===" -ForegroundColor Green

foreach ($plan in $diffResponse.plans) {
    Write-Host "`n--- $($plan.schema).$($plan.name) ($($plan.type)) ---" -ForegroundColor Cyan
    
    if ($plan.diffSummary) {
        $ds = $plan.diffSummary
        Write-Host "  Added: $(if($ds.added -and $ds.added.Count) { $ds.added -join ', ' } else { '(none)' })" -ForegroundColor Green
        Write-Host "  Removed: $(if($ds.removed -and $ds.removed.Count) { $ds.removed -join ', ' } else { '(none)' })" -ForegroundColor Red
        
        if ($ds.altered -and $ds.altered.Count) {
            Write-Host "  Altered:" -ForegroundColor Yellow
            foreach ($alt in $ds.altered) {
                if ($alt.from -and $alt.to) {
                    Write-Host "    $($alt.column): $($alt.from) → $($alt.to)" -ForegroundColor Yellow
                } else {
                    Write-Host "    $($alt.column)" -ForegroundColor Yellow
                }
            }
        } else {
            Write-Host "  Altered: (none)" -ForegroundColor Yellow
        }
    }
    
    if ($plan.notes -and $plan.notes.Count) {
        Write-Host "  Notes: $($plan.notes -join '; ')" -ForegroundColor Gray
    }
}

# Step 4: Show combined implementation
Write-Host "`n=== Step 4: Combined Implementation Script ===" -ForegroundColor Green
Write-Host $diffResponse.combinedImpl -ForegroundColor White

# Step 5: Show combined rollback  
Write-Host "`n=== Step 5: Combined Rollback Script ===" -ForegroundColor Green
Write-Host $diffResponse.combinedRollback -ForegroundColor White

# Step 6: Validation (dry run)
if ($DryRun -or -not $Execute) {
    Write-Host "`n=== Step 6: Validation (Dry Run) ===" -ForegroundColor Green
    
    $validateBody = @{
        env = $TargetEnv
        script = $diffResponse.combinedImpl
        user = $env:USERNAME
        correlationId = "MUFO-DEPLOY-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        gitCommit = "cmd-deploy"
    }
    
    Write-Host "Validating implementation on $TargetEnv (dry run)..." -ForegroundColor Yellow
    $validateResponse = Invoke-DeploymentAPI -Endpoint "/ddl/apply?dryRun=true" -Body $validateBody
    
    if ($validateResponse -and $validateResponse.success) {
        Write-Host "✅ Validation successful - implementation is ready to execute" -ForegroundColor Green
    } else {
        Write-Error "❌ Validation failed: $($validateResponse.message)"
        if (-not $Execute) {
            Write-Host "`nUse -Execute flag to proceed anyway (not recommended)" -ForegroundColor Yellow
        }
        exit 1
    }
}

# Step 7: Execute implementation
if ($Execute) {
    Write-Host "`n=== Step 7: Executing Implementation ===" -ForegroundColor Green
    
    $confirmation = Read-Host "Are you sure you want to execute the implementation on $TargetEnv? Type 'APPLY' to confirm"
    
    if ($confirmation -eq "APPLY") {
        $executeBody = @{
            env = $TargetEnv
            script = $diffResponse.combinedImpl
            user = $env:USERNAME
            correlationId = "MUFO-DEPLOY-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
            gitCommit = "cmd-deploy"
        }
        
        Write-Host "Executing implementation on $TargetEnv..." -ForegroundColor Yellow
        $executeResponse = Invoke-DeploymentAPI -Endpoint "/ddl/apply" -Body $executeBody
        
        if ($executeResponse -and $executeResponse.success) {
            Write-Host "✅ Implementation executed successfully!" -ForegroundColor Green
            Write-Host "MUFO tables have been deployed from $SourceEnv to $TargetEnv" -ForegroundColor Green
        } else {
            Write-Error "❌ Implementation failed: $($executeResponse.message)"
            Write-Host "`nRollback script available if needed:" -ForegroundColor Yellow
            Write-Host $diffResponse.combinedRollback -ForegroundColor White
            exit 1
        }
    } else {
        Write-Host "❌ Deployment cancelled by user" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "`n=== Deployment Preview Complete ===" -ForegroundColor Green
    Write-Host "To execute the deployment, run with -Execute flag:" -ForegroundColor Yellow
    Write-Host ".\deploy_mufo_tables.ps1 -Execute" -ForegroundColor Cyan
}

Write-Host "`n=== Deployment Script Complete ===" -ForegroundColor Cyan