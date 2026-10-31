$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22+ and restart PowerShell.' }
$major = [int]((& node --version).TrimStart('v').Split('.')[0])
if ($major -lt 22) { throw 'Node.js 22+ required.' }
$ff = if ($env:REANIMATE_FFMPEG) { $env:REANIMATE_FFMPEG } else { 'ffmpeg' }
& $ff -hide_banner -version
if ($LASTEXITCODE -ne 0) { throw 'ffmpeg unavailable. Add ffmpeg to PATH or set REANIMATE_FFMPEG.' }
$filters = & $ff -hide_banner -filters 2>&1 | Out-String
if ($LASTEXITCODE -ne 0 -or $filters -notmatch '\bdrawtext\b' -or $filters -notmatch '\btile\b') { throw 'ffmpeg must support drawtext and tile.' }
$encoders = & $ff -hide_banner -encoders 2>&1 | Out-String
if ($LASTEXITCODE -ne 0 -or $encoders -notmatch '\blibx264\b') { throw 'ffmpeg must support libx264.' }
Push-Location $PSScriptRoot
try {
 & node --input-type=module -e "await import('playwright-core')"
 if ($LASTEXITCODE -ne 0) { throw 'Run npm ci --ignore-scripts in the skill scripts directory.' }
} finally { Pop-Location }
$browsers = @($env:MOTIONLAB_BROWSER, 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', 'C:\Program Files\Microsoft\Edge\Application\msedge.exe', 'C:\Program Files\Google\Chrome\Application\chrome.exe')
$browser = $browsers | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $browser) { throw 'Install Edge/Chrome or set MOTIONLAB_BROWSER.' }
Write-Output "Ready. Browser: $browser. No packages or browsers installed by setup."
