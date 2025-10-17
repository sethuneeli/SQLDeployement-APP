$ErrorActionPreference = 'Stop'

# Build request body as JSON (ConvertTo-Json handles quoting)
$payload = [ordered]@{
  env     = 'TEST'
  script  = "-- noop commit for object history test`nSELECT 1 as x;"
  objects = @('Sales.Customers')
  user    = 'sethun'
} | ConvertTo-Json -Depth 6

Write-Host "Posting to /ddl/apply..."
$resp = Invoke-RestMethod -Uri "http://localhost:3000/ddl/apply" -Method Post -ContentType "application/json" -Body $payload
$resp | ConvertTo-Json -Depth 6
