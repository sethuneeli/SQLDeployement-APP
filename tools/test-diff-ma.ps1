$ErrorActionPreference = 'Stop'

$payload = [ordered]@{
  fromEnv = 'DEV'
  toEnv   = 'TEST'
  objects = @(@{ type = 'TABLE'; schema = 'MA'; name = 'DemoX' })
} | ConvertTo-Json -Depth 6

Write-Host "Posting /ddl/diff for MA.DemoX (DEV -> TEST) ..."
$resp = Invoke-RestMethod -Uri "http://localhost:3000/ddl/diff" -Method Post -ContentType "application/json" -Body $payload
$resp | ConvertTo-Json -Depth 6

# Show only the preface of combinedImpl to see schema creation lines
if ($resp.combinedImpl) {
  Write-Host "--- combinedImpl (first 300 chars) ---"
  $txt = [string]$resp.combinedImpl
  if ($txt.Length -gt 300) { $txt.Substring(0,300) } else { $txt }
}