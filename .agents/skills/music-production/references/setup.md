# Local runtime maintenance

This skill is maintained in the local project. The current skill, code and
project decisions define its behavior. There is no external skill update,
repository synchronization or plugin reinstall step.

## Fresh Git checkout (Windows x64)

A Git checkout contains the code, tests, notices, pinned dependency locks and
`local-config.example.json`. Installed binaries, Python environments and the
machine-specific `local-config.json` are generated locally. For a first install
in a newly cloned MotionLab checkout, use the existing bootstrap below. This is
an explicit initial dependency installation, not a skill update. It downloads
only the pinned runtime versions and 50 curated patches; it leaves the optional
full catalog out. Do not run it over an already working prepared environment.

Prerequisites: Node.js 22+, regular CPython 3.14 x64 with the Windows `py`
launcher, Edge or Chrome, and internet access for the pinned downloads. Run from
the MotionLab repository root in PowerShell:

```powershell
$audioSkill = Join-Path (Get-Location) '.agents/skills/music-production'
py -3.14 -m venv "$audioSkill/.venv"
& "$audioSkill/.venv/Scripts/python.exe" -m pip install --only-binary=:all: --require-hashes -r "$audioSkill/requirements.txt"
& "$audioSkill/.venv/Scripts/python.exe" "$audioSkill/scripts/bootstrap.py" --runtime "$audioSkill/runtime" --config "$audioSkill/local-config.json" --no-surge-catalog
New-Item -ItemType Directory -Force -Path "$audioSkill/runtime/surge_xt/SurgeXTData", "$audioSkill/runtime/surge_xt/SurgeXTUserData" | Out-Null

$ffmpegDirectory = Join-Path $audioSkill 'runtime/ffmpeg/ffmpeg-9.0.2-essentials_build/bin'
$env:MOTIONLAB_FFMPEG = Join-Path $ffmpegDirectory 'ffmpeg.exe'
$env:MOTIONLAB_FFPROBE = Join-Path $ffmpegDirectory 'ffprobe.exe'
$env:PATH = "$audioSkill/.venv/Scripts;$ffmpegDirectory;$env:PATH"
npm ci --ignore-scripts --prefix .agents/skills/motionlab/scripts
& .agents/skills/motionlab/scripts/setup.ps1
& "$audioSkill/.venv/Scripts/python.exe" "$audioSkill/scripts/studio.py" doctor --config "$audioSkill/local-config.json"
```

The bootstrap refuses an existing config path. Keep an already installed runtime
and its config; diagnose a failed installation before trying again, with a new
config path if required. Read bootstrap output: a missing Surge/pedalboard
installation is reported as `SKIPPED` and is not proof of the full setup.
The offline `prepare_runtime.py` command below belongs to the separately
prepared bundle; do not use it on this pip/bootstrap layout.

The environment assignments above last only for this PowerShell process. In a
new agent session, use these local executables again (or provide FFmpeg/ffprobe
on PATH); no persistent system settings are needed. The existing agent tools
use the skill's local Python and `local-config.json`.

Copy `.env.example` to a new `.env` for optional API functions and supply
your own keys. Music/effects need no API key. Never commit the filled-in file.
No composition or paid API call is part of installation.

## Prepared Windows environment

Use the offline bundle and local environment described in
[motionlab.md](motionlab.md). `scripts/prepare_runtime.py` verifies its dependencies
and creates a fresh local environment without downloads. An existing healthy
project environment stays in use. Run `studio.py doctor --config <config>` when
installing, relocating or diagnosing the environment; health checks do not
compose, render or export music.

If a configured file is missing or its hash changes, identify the local cause
and recover the expected file from the prepared bundle. Do not silently replace
its hash, download newer versions or switch to another installation. Keep the
configuration's relative paths within this skill and the portable Surge data
folders inside `runtime/surge_xt/`.

## Explicit dependency changes

Additional instrument banks, a different Python/platform, the full Surge catalog
or new dependency versions require a concrete user request. Inspect the existing
local code, installed tools, requirements and locks first. Use official dependency
sources and verify pinned hashes and license notices; record the accepted local
change. Dependency source URLs in locks and receipts are provenance, not a request
to update the skill.

Retained `bootstrap.py`, `fetch_soundbanks.py`, `requirements.txt` and bank-building
specifications remain available for such a requested expansion. Review their
options before use; they are the initial setup above for a fresh Git checkout, but are not the default setup for an already prepared portable bundle.
Keep installation local, preserve existing environments and sources, and write
revised configurations to a new path. Do not install globally or change persistent
PATH, environment variables or Codex configuration.

## Verification

Use `tests/test_portable_runtime.py` for configuration/runtime regression checks.
The large `scripts/selfcheck.py` includes compositions and real renders; run it
only when that kind of testing has been requested, not as an installation check.
Validate and render music only in response to an actual composition/render request.
