param(
  [Parameter(Mandatory=$true)][string]$Name,
  [string]$Type = 'TABLE',
  [string]$Schema = 'dbo',
  [string]$FromEnv = 'DEV',
  [string]$ToEnv = 'TEST',
  [switch]$AutoCreateSchemas = $true,
  [string]$User = 'test-move',
  [string]$CorrelationId = 'auto'
)

$ErrorActionPreference = 'Stop'

function Invoke-JsonPost($Url, $Body) {
  $json = $Body | ConvertTo-Json -Depth 20
  return Invoke-RestMethod -Method Post -Uri $Url -ContentType 'application/json' -Body $json
}

function Write-Section($Title) { Write-Host "==== $Title ==== " -ForegroundColor Cyan }

# Basic health check
try {
  $ping = Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/api/simple-working-test' -TimeoutSec 5
  if(-not $ping){ throw 'Server did not respond' }
} catch {
  Write-Error "Server not running at http://localhost:3000. Start it first (node .)."
  exit 1
}

Write-Section "Generate diff ($FromEnv -> $ToEnv) for $Type $Schema.$Name"
$objects = @(@{ type = $Type.ToUpper(); schema = $Schema; name = $Name })
$diffBody = @{ fromEnv = $FromEnv; toEnv = $ToEnv; objects = $objects }
$diff = Invoke-JsonPost 'http://localhost:3000/ddl/diff' $diffBody
if(-not $diff.success){ Write-Error ("Diff failed: " + ($diff.message | Out-String)); exit 2 }
$combinedImpl = [string]$diff.combinedImpl
$combinedRollback = [string]$diff.combinedRollback
if([string]::IsNullOrWhiteSpace($combinedImpl)){
  Write-Host 'No implementation required.' -ForegroundColor Yellow
  exit 0
}

Write-Section 'Validate implementation (dry-run)'
$valBody = @{ env = $ToEnv; script = $combinedImpl; autoCreateSchemas = ($AutoCreateSchemas.IsPresent); user = $User; correlationId = $CorrelationId; objects = @("$Schema.$Name") }
$val = Invoke-JsonPost 'http://localhost:3000/ddl/apply?dryRun=true' $valBody
if(-not $val.success){ Write-Error ("Validation failed: " + ($val.message | Out-String)); exit 3 }
Write-Host 'Validation succeeded.' -ForegroundColor Green

Write-Section 'Apply implementation'
$applyBody = @{ env = $ToEnv; script = $combinedImpl; rollbackScript = $combinedRollback; autoCreateSchemas = ($AutoCreateSchemas.IsPresent); user = $User; correlationId = $CorrelationId; objects = @("$Schema.$Name") }
$apply = Invoke-JsonPost 'http://localhost:3000/ddl/apply' $applyBody
if(-not $apply.success){ Write-Error ("Apply failed: " + ($apply.message | Out-String)); exit 4 }

# Extract commit info across both legacy/enhanced shapes
$commitHash = $null
$files = @()
if($apply.git -and $apply.git.commitHash){ $commitHash = $apply.git.commitHash }
elseif($apply.gitCommitHash){ $commitHash = $apply.gitCommitHash }
if($apply.git -and $apply.git.files){ $files = $apply.git.files }
elseif($apply.gitFile){ $files = @($apply.gitFile) }

Write-Host ("Apply succeeded. Commit: " + ($commitHash ?? '(unknown)')) -ForegroundColor Green
if($files -and $files.Count -gt 0){
  Write-Host ("Files: " + ($files -join ', ')) -ForegroundColor DarkGreen
}

Write-Section 'Verify object history in Git'
$histUrl = "http://localhost:3000/api/git/object-history/$($Type.ToUpper())/$Schema/$Name?limit=10"
$hist = Invoke-RestMethod -Method Get -Uri $histUrl
if($hist.success){
  $cnt = ($hist.history | Measure-Object).Count
  Write-Host ("Found $cnt commit(s) for $Schema.$Name") -ForegroundColor Green
  if($cnt -gt 0){
    ($hist.history | Select-Object -First 3) | ForEach-Object { Write-Host ("- " + $_.shortHash + ' ' + $_.message) }
  }
} else {
  Write-Host 'No history found or API not available.' -ForegroundColor Yellow
}

Write-Host 'DEV→TEST move complete.' -ForegroundColor Cyan
