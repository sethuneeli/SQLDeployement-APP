Param(
  [Parameter(Mandatory=$true)][string]$SqlInstance,
  [Parameter(Mandatory=$true)][string]$Database,
  [Parameter(Mandatory=$true)][string]$File
)

try {
  Import-Module dbatools -ErrorAction Stop
} catch {
  $err = @{ error = "dbatools module not found. Install with: Install-Module dbatools -Scope CurrentUser -Force"; details = $_.Exception.Message }
  $err | ConvertTo-Json -Depth 5
  exit 10
}

try {
  if (-not (Test-Path $File)) { throw "File not found: $File" }
  $query = Get-Content -Path $File -Raw -ErrorAction Stop

  # Run the query using dbatools
  $rows = Invoke-DbaQuery -SqlInstance $SqlInstance -Database $Database -Query $query -ErrorAction Stop

  # Convert result to JSON and write to stdout
  $rows | ConvertTo-Json -Depth 10
  exit 0
} catch {
  $err = @{ error = $_.Exception.Message; details = $_.Exception.ToString() }
  $err | ConvertTo-Json -Depth 5
  exit 2
}
