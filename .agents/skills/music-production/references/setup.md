# Local runtime maintenance

This skill is maintained in the local project. The current skill, code and
project decisions define its behavior. There is no external skill update,
repository synchronization or plugin reinstall step.

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
options before use; they are not the default setup for this portable bundle.
Keep installation local, preserve existing environments and sources, and write
revised configurations to a new path. Do not install globally or change persistent
PATH, environment variables or Codex configuration.

## Verification

Use `tests/test_portable_runtime.py` for configuration/runtime regression checks.
The large `scripts/selfcheck.py` includes compositions and real renders; run it
only when that kind of testing has been requested, not as an installation check.
Validate and render music only in response to an actual composition/render request.
