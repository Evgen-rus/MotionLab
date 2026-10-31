$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22+ and restart PowerShell.' }
$major = [int]((& node --version).TrimStart('v').Split('.')[0])
if ($major -lt 22) { throw 'Node.js 22+ required.' }
$ff = if ($env:REANIMATE_FFMPEG) { $env:REANIMATE_FFMPEG } else { 'ffmpeg' }
& $ff -hide_banner -version
if ($LASTEXITCODE -ne 0) { throw 'ffmpeg unavailable. Add ffmpeg to PATH or set REANIMATE_FFMPEG to its .exe path.' }
$filters = & $ff -hide_banner -filters 2>&1 | Out-String
if ($LASTEXITCODE -ne 0 -or $filters -notmatch '\bdrawtext\b' -or $filters -notmatch '\btile\b') { throw 'ffmpeg must support drawtext and tile.' }
Write-Output 'Ready. No packages or browsers installed.'
