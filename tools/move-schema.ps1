param(
  [Parameter(Mandatory=$true)][ValidateSet('DEV','TEST','PROD','LIVE')][string]$FromEnv,
  [Parameter(Mandatory=$true)][ValidateSet('DEV','TEST','PROD','LIVE')][string]$ToEnv,
  [Parameter(Mandatory=$true)][string]$Schema,
  [string]$User = $env:USERNAME,
  [switch]$AutoCreateSchemas
)

$ErrorActionPreference = 'Stop'

function Invoke-JsonPost {
  param([string]$Uri, [object]$Body)
  $json = $Body | ConvertTo-Json -Depth 12
  return Invoke-RestMethod -Uri $Uri -Method Post -ContentType 'application/json' -Body $json
}

function Get-ObjectsInSchema {
  param([string]$Env, [string]$Schema)
  $url = "http://localhost:3000/db/objects?env=$Env"
  $resp = Invoke-RestMethod -Uri $url -Method Get
  if(-not $resp.success){ throw "Failed to fetch objects for $Env" }
  return @($resp.objects | Where-Object { $_.schema -eq $Schema -and $_.type -in @('TABLE','VIEW','PROCEDURE','FUNCTION','TRIGGER','INDEX') })
}

Write-Host "Collecting objects in schema '$Schema' from $FromEnv..." -ForegroundColor Cyan
$objs = Get-ObjectsInSchema -Env $FromEnv -Schema $Schema
if($objs.Count -eq 0){
  Write-Host "No supported objects found under $Schema in $FromEnv." -ForegroundColor Yellow
  exit 0
}

# Build object list for diff
$objectsForDiff = @()
foreach($o in $objs){
  $type = $o.type
  $name = if($o.name){ $o.name } elseif($o.table){ $o.table } else { $null }
  if(-not $name){ continue }
  $objectsForDiff += @{ type = $type; schema = $Schema; name = $name }
}

Write-Host "Planning $FromEnv -> $ToEnv for schema $Schema with $($objectsForDiff.Count) objects..." -ForegroundColor White
$diffBody = [ordered]@{
  fromEnv = $FromEnv
  toEnv   = $ToEnv
  objects = @($objectsForDiff)
}
$diff = Invoke-JsonPost -Uri 'http://localhost:3000/ddl/diff' -Body $diffBody
if(-not $diff.success){ throw "Diff failed: $($diff.message)" }

$impl = [string]$diff.combinedImpl
if([string]::IsNullOrWhiteSpace($impl)){
  Write-Host 'No implementation needed.' -ForegroundColor Yellow
  exit 0
}

Write-Host 'Validating (dry run)...' -ForegroundColor DarkGray
$applyBodyDry = [ordered]@{
  env    = $ToEnv
  script = $impl
  dryRun = $true
  user   = $User
  objects= @($objectsForDiff | ForEach-Object { "$Schema.$($_.name)" })
  autoCreateSchemas = [bool]$AutoCreateSchemas
}
$dry = Invoke-JsonPost -Uri "http://localhost:3000/ddl/apply?dryRun=true" -Body $applyBodyDry
if(-not $dry.success){ throw "Validation failed: $($dry.message)" }
Write-Host ("Dry run rowsAffected: {0}" -f $dry.rowsAffected) -ForegroundColor DarkGray

Write-Host "Applying to $ToEnv..." -ForegroundColor White
$applyBody = [ordered]@{
  env    = $ToEnv
  script = $impl
  user   = $User
  objects= @($objectsForDiff | ForEach-Object { "$Schema.$($_.name)" })
  autoCreateSchemas = [bool]$AutoCreateSchemas
}
$applied = Invoke-JsonPost -Uri 'http://localhost:3000/ddl/apply' -Body $applyBody
if(-not $applied.success){ throw "Apply failed: $($applied.message)" }

Write-Host ("Success. RowsAffected: {0}" -f $applied.rowsAffected) -ForegroundColor Green
if($applied.gitCommitHash){ Write-Host ("Git Commit: {0}" -f $applied.gitCommitHash) -ForegroundColor Cyan }

# Show a tiny object history sample for first few objects
$sample = @($objectsForDiff | Select-Object -First 3)
foreach($o in $sample){
  $histUri = "http://localhost:3000/api/git/object-history/$($o.type)/$Schema/$($o.name)?limit=3"
  try {
    $hist = Invoke-RestMethod -Uri $histUri -Method Get
    if($hist.success -and $hist.history.Count -gt 0){
      Write-Host ("History for {0}.{1}:" -f $Schema, $o.name) -ForegroundColor DarkCyan
      $hist.history | Select-Object -First 2 | ForEach-Object { Write-Host ("  {0} {1} - {2}" -f $_.shortHash, $_.date, $_.message) }
    }
  } catch {}
}
