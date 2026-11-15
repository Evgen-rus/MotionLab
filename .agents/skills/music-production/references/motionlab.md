# MotionLab audio profile

For a fresh Git checkout without installed dependencies, follow [the initial
Windows installation](setup.md#fresh-git-checkout-windows-x64). The offline
steps below apply when the complete prepared runtime folder is supplied.

## Portable local environment

The prepared bundle is for Windows x64 with the installed CPython 3.14 (regular,
not free-threaded). It contains the already installed, pinned NumPy 2.5.4,
FluidSynth 2.6.1, FFmpeg 9.0.2, MS Basic, Surge XT 1.3.4, pedalboard 0.9.26 and
50 curated presets. It has no API dependency and downloads nothing on setup.
All genre guides and musical engines are retained; optional acoustic banks and
the full Surge catalog are not bundled.

Copy the complete `music-production` folder into the destination project's
`.agents/skills/`. Keep its `runtime/`, `local-config.json`, notices and lock files
together. Do not copy an old `.venv`: from an existing system CPython 3.14 run
`<skill>/scripts/prepare_runtime.py`. It verifies the bundled files, creates a
fresh local `.venv` without pip, and points that environment to the unchanged
vendored NumPy via a relative `.pth` file. Nothing is installed globally.
Run the resulting Python with `scripts/studio.py doctor --config
<skill>/local-config.json`; setup and doctor do not generate music.

The trusted configuration uses paths relative to its own directory. The engine
resolves all dependencies, including Surge/patches/pedalboard, from that directory
even when called from another cwd. Keep both `SurgeXTData` and `SurgeXTUserData`
inside `runtime/surge_xt/` so portable mode does not use global data folders.
For a sandbox with an unusable system temp, set process-only `TEMP` and `TMP` to
a writable temporary folder inside the current project. Do not change persistent
environment variables. Run native commands in the integrated executor.

The bundle's `runtime-manifest.json` verifies dependency files. Its existing
runtime/requirements locks, package RECORDs and licenses keep the original
provenance. Do not run bootstrap on an already prepared bundle;
`setup.md` covers local maintenance and explicitly requested expansion only.
This skill is maintained in the local project; its current files define the
workflow. There is no automatic skill-update or external synchronization step.

## Handoff to a video project

MotionLab's `job.json` is the source for the video's existing brief, duration and
sound choices. Resolve its asset paths against the job's directory. Read only
what is useful for the audio: narration timing, music role/style, important scene
changes and ending. Reuse answers already supplied; do not restart video intake.

Keep this cue under `projects/<video title>/звук/<cue or revision>/` in MotionLab.
Use new paths for revisions. A standalone request without a video project uses
`projects/<audio title>/звук/<cue or revision>/` with a descriptive title. Store
music notes, scripts, cache and results there; dependencies stay in the skill. Never refer to the old
MusicLab checkout or link across project roots.

When integrating with authorized video work, record the selected music WAV in
the existing `job.audio.music` structure and preserve other fields. Existing
projects use either a path or an object, so inspect that job rather than silently
inventing a replacement schema. Preserve narration, effects, approvals and exports.
Copy externally created selected audio into the video folder for a self-contained
project. Do not modify another project just because it was inspected.

MotionLab currently accepts one ready mix through `render.mjs --audio`. It keeps
music, individual effects, original/aligned voice and final mix separately.
Mix these with its existing FFmpeg workflow; keep the source music at its own
quality and decide ducking/gain against the actual narrator there. Pad/trim in
the muxer is not a musical ending: compose the ending to fit the requested time.
For an audio-only revision of a cached video, reuse the graphics and remux the
new mix under MotionLab's existing approval rules.

Workbench currently accepts video imports and detached audio from those videos.
Standalone WAV/MP3 import needs a separate code change; do not present it as
already supported or wrap music in a fake video to work around that limit.
Music generation and file delivery do not require that editor change.

## Short cues and effects

Include musical release/reverb in the total requested seconds. For constant
tempo, total seconds = bars * quarter-beats-per-bar * 60 / BPM + tail_seconds.
Use the tempo map when exact visual beats require it. Choose a real closing
gesture plus ring-out, a deliberate fade, or a loop seam as requested.

Compose background music to leave space for narration. Avoid a busy lead during
important lines; use an opening, a restrained bed and accents at the agreed hits.
Do not add narration synthesis or copy MotionLab's speech credentials here.

For synthetic whooshes, impacts and risers, use the retained `noise`, synth and
drum engines; see `schema.md` and `electronic-sounds.md`. Deliver effects as
separate checked WAV files when they must be moved or muted independently.
Record their intended time, gain and enabled state in MotionLab's existing
effects plan, not as permanent changes baked into the music. Sample-accurate
placement belongs to MotionLab's final mix; a short pre-roll in an effect file
must be included in its documented timing. Label synthetic foley honestly.

If no genre was specified, offer suitable directions or pick within delegated
choices. All styles remain available as composition guidance; installing more
instruments is a separate explicit request. Keep score validation, peak/clipping,
duration and quiet-tail checks on the delivered WAV; no automatic MP3/FLAC copies. A single successful full render
can be the delivered result. Preserve revisions and caches; source ZIP delivery
and cleanup are optional.
