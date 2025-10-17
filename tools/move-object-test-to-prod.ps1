param(
  [Parameter(Mandatory=$true)][ValidateSet('TABLE','VIEW','PROCEDURE','FUNCTION','TRIGGER','INDEX')][string]$Type,
  [Parameter(Mandatory=$true)][string]$Schema,
  [Parameter(Mandatory=$true)][string]$Name,
  [string]$User = $env:USERNAME,
  [switch]$AutoCreateSchemas
)

$ErrorActionPreference = 'Stop'

function Invoke-JsonPost {
  param([string]$Uri, [object]$Body)
  $json = $Body | ConvertTo-Json -Depth 10
  return Invoke-RestMethod -Uri $Uri -Method Post -ContentType 'application/json' -Body $json
}

Write-Host "Planning TEST -> PROD for $Type $Schema.$Name ..."
$diffBody = [ordered]@{
  fromEnv = 'TEST'
  toEnv   = 'PROD'
  objects = @(@{ type = $Type; schema = $Schema; name = $Name })
}
$diff = Invoke-JsonPost -Uri 'http://localhost:3000/ddl/diff' -Body $diffBody

if(-not $diff.success){ throw "Diff failed: $($diff.message)" }

# Combine implementation script (server already joins with GO). Ensure string type.
$impl = [string]$diff.combinedImpl
if([string]::IsNullOrWhiteSpace($impl)){
  Write-Host 'No implementation needed.' -ForegroundColor Yellow
  exit 0
}

Write-Host 'Validating (dry run)...'
$applyBodyDry = [ordered]@{
  env    = 'PROD'
  script = $impl
  dryRun = $true
  user   = $User
  objects= @("$Schema.$Name")
  autoCreateSchemas = [bool]$AutoCreateSchemas
}
$dry = Invoke-JsonPost -Uri 'http://localhost:3000/ddl/apply?dryRun=true' -Body $applyBodyDry
if(-not $dry.success){ throw "Validation failed: $($dry.message)" }
Write-Host "Dry run rowsAffected: $($dry.rowsAffected)" -ForegroundColor DarkGray

Write-Host 'Applying to PROD...'
$applyBody = [ordered]@{
  env    = 'PROD'
  script = $impl
  user   = $User
  objects= @("$Schema.$Name")
  autoCreateSchemas = [bool]$AutoCreateSchemas
}
$applied = Invoke-JsonPost -Uri 'http://localhost:3000/ddl/apply' -Body $applyBody
if(-not $applied.success){ throw "Apply failed: $($applied.message)" }

Write-Host "Success. RowsAffected: $($applied.rowsAffected)" -ForegroundColor Green
if($applied.gitCommitHash){ Write-Host "Git Commit: $($applied.gitCommitHash)" -ForegroundColor Cyan }

# Show object-specific history line quickly
$histUri = "http://localhost:3000/api/git/object-history/$Type/$Schema/$Name?limit=5"
$hist = Invoke-RestMethod -Uri $histUri -Method Get
if($hist.success -and $hist.history.Count -gt 0){
  Write-Host "Latest object history:" -ForegroundColor DarkCyan
  $hist.history | Select-Object -First 3 | ForEach-Object { Write-Host ("  {0} {1} - {2}" -f $_.shortHash, $_.date, $_.message) }
}
