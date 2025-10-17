$ErrorActionPreference = 'SilentlyContinue'
# Stop anything listening on 3000
$cons = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($cons) {
  ($cons | Select-Object -ExpandProperty OwningProcess -Unique) | ForEach-Object { try { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } catch {} }
}
Start-Sleep -Milliseconds 500

# Start server detached
$wd = 'C:\VS_DBProject\GIT_Portal_SQL'
Start-Process -FilePath 'node' -ArgumentList 'app.js' -WorkingDirectory $wd -WindowStyle Hidden
Start-Sleep -Seconds 1

# Print listener count
$cnt = (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host "Listening on 3000: $cnt"