# Portable tools

## Local editing Workbench

Workbench has two modes: “Монтаж” retains footage/audio editing and MP4 export; “Структура сцены” inspects authored HTML without editing it or bypassing render approvals. It discovers the project's explicit `versions[].scene` and `approval.source` HTML paths from `job.json`. The viewer is sandboxed, only serves resources within that scene directory, blocks external resources/API access, mutes scene media, and drives the real `window.__video.seek` contract. Copy context includes the relative and absolute source path, SHA-256 of that HTML revision, scene and element identity, content, appearance, motion description and current time. A changed HTML source must be refreshed before copying. Clipboard denial offers selectable output for Ctrl+C, never an input for a change request. Updating only an external asset requires manual “Обновить сцену”. No metadata is inferred from rendered MP4 pixels.

Mark new scenes explicitly (the bundled `assets/scene.html` is a working example):

```html
<section data-scene-id="intro" data-scene-name="Вступление" data-start="0" data-end="6">
  <h1 data-element-id="headline" data-element-name="Заголовок"
      data-element-type="Текст" data-start="0.4" data-end="6"
      data-motion="Появление снизу · 0,6 с">Текст ролика</h1>
</section>
```

Element IDs must be unique across the HTML, begin with a Latin letter, and use only Latin letters, digits, `_` and `-`. Omitted element times inherit their scene's interval; omitted scene times cover the full video. Describe motion accurately; do not change an existing `[data-motion]` selector's membership accidentally. Elements outside scene groups appear in every scene. Unmarked scenes can be previewed but show a clear no-elements message. Maintain IDs across revisions so copied requests still identify the intended element. This mode is a view and selection tool; it does not introduce a new scene renderer or replace `edit.json`.

Open a named project's dark video-editing UI (runs on `127.0.0.1` only):

`node "<skill>/scripts/workbench.mjs" --project "Название ролика"`

Import files through the browser or through the agent conversation:

`node "<skill>/scripts/workbench.mjs" --project "Название ролика" --import "<local video path>"`

Apply a limited natural-language command: `--command "Раздели клип 1 на 3"`. Other examples: `Обрежь клип 1 с 2 до 5`, `Перемести клип 2 на позицию 1`, `Убери звук у клипа 1`, `Формат 9:16`. For any other phrasing, the agent maps the request to an operation such as `--action '{"type":"trim","index":1,"start":2,"end":5}'`. Supported video action types: `append` with mediaId, `trim` with index/start/end, `split` with index/at (source-relative seconds), `move` with index/to, `remove` with index, `mute` with index/muted, `format` with format. Additional actions: `detach` with video index; `audio` with audio `id` and optional source-relative start/end, timeline-relative at, rate (0.5–2), gain (0–1), muted; `splitAudio` with id and source-relative at; `removeAudio` with id; `removeMedia` with mediaId; `undo`; `redo`. The last 30 edits (including CLI edits/imports) persist across restart. Removing unused media only removes the project entry; its file remains. Used video/audio sources cannot be removed. Use IDs from `projects/<title>/edit.json`; index is 1-based. The UI refreshes external changes automatically.

When the user explicitly asks for a final MP4, use `--export yes` or the UI Export button. The FFmpeg montage uses cuts, aspect-preserving letterboxing/padding, 30 fps, H.264/AAC, and silence when a source has no audio. Detached audio is mixed with its own position, boundaries, gain and pitch-preserving tempo; the video's original sound is disabled on detachment. Audio does not follow subsequent video reordering/trims. Output duration follows video, with audio tails trimmed. Browser audio preview uses independent HTML audio players, so timing is approximate; FFmpeg export uses sample-based placement. Exports are unique directories under `projects/<title>/монтаж/`. It is an editing tool for existing footage, not a substitute for the authored-scene `render.mjs` approval workflow. Only local video files are accepted, and the browser may be unable to preview some MOV/MKV codecs; the export processor can still handle them if FFmpeg supports them. The UI needs Node.js 22+, FFmpeg and ffprobe; it does not require Edge/Chrome for server startup, although a browser is needed to view it.

## Optional local sound synthesis

## OpenRouter narration

Use environment variables from the destination project root's `.env` (see `.env.example`); Node's `--env-file-if-exists=.env` loads them without a dependency and preserves existing environment overrides. Never print the key. Enable with `OWNER_VOICE_ENABLED=true`, set `OPENROUTER_API_KEY` and the model-specific `OPENROUTER_TTS_VOICE`. Default model: `fish-audio/s2.1-pro-free:free`; timeout: 120 seconds; cost cap: 0 USD. Voice example: `cb92b10e1a5946b9b6bd7391aefe31fe`.

Save the approved narration in a UTF-8 file in the named project, deliver its text to the user first, then run:

`node --env-file-if-exists=.env "<skill>/scripts/speech.mjs" --in "projects/Название ролика/диктор.txt" --out "projects/Название ролика/озвучка-01"`

The new output directory contains cleaned `text.txt` even if audio fails, and `voice.mp3` on success; stdout emits the text before the audio path, stderr emits fixed secret-free errors and exit code is 1 on audio failure. Before final storyboard/render approval, present `voice.mp3` as a playable audio preview and link the separate MP3; let the user choose or request another available voice and wait for the choice unless explicit fast-mode delegation applies. Preserve each preview in a new directory. If generation or playback is unavailable, explain the limitation and do not claim the voice was approved. Cleaned input is capped at 12,000 characters, audio at 10 MiB. Price catalog is cached in the provider instance for 15 minutes, never reused after expiry. Only speech models with explicitly zero prompt/completion and all other reported prices zero are currently supported. Paid pricing shapes remain unknown and blocked even with a positive cap, because output duration/token costs cannot be bounded reliably. No fallback model is used.

Pass `voice.mp3` to `render.mjs --audio` for the approved scene. The renderer pads/trims sound to the video length: check spoken duration before rendering to avoid cutting narration. When music is requested, mix the separate narration/music/effect stems with FFmpeg first. Workbench can edit audio detached from imported video; standalone MP3/WAV import is not yet supported. Use the authored-scene renderer for narrated animation.

### Local synthesis

Python 3 with NumPy is optional: check `python -c "import numpy; print(numpy.__version__)"`. If missing, use a project-local venv (`python -m venv .venv`, then `.venv/Scripts/python -m pip install numpy` on Windows; `.venv/bin/python -m pip install numpy` on Linux). No SciPy or external API is needed. The supplied demo uses SciPy filters; this implementation uses simple NumPy noise differentiation, oscillators and envelopes instead. Synthetic timbres are approximations.

`python "<skill>/scripts/synth_audio.py" --out "projects/Проверка звука/audio-A" --duration 6 --tempo 108 --mood warm --instruments kick,snare,hat,bass,chords --seed 42`

Use an initialized named project. Output directory must be new and inside projects. Options: duration 0.1–120 seconds, tempo 30–240 BPM; mood warm/bright/dark changes harmony; instruments is a comma-separated subset of kick/snare/hat/bass/chords. For three previews run into audio-A/B/C, e.g. warm/108/full ensemble, bright/128/kick,hat,bass, dark/72/bass,chords. Adapt these choices to the brief, not a fixed style. `--effects cues.json` accepts an array of `{ "time": 0.5, "kind": "tap", "gain": 0.12, "pan": 0, "enabled": true }`; kinds tap/drop/swoosh; `[]` means no effects. Default cues are a demonstration, replace with scene timings.

Outputs: music.wav, sfx.wav, mix.wav (stereo 44.1 kHz PCM16), individual mono effect-NN.wav and recipe.json. Effect-file gain is baked in; recipe gain=1 with pan/time retained. Record command/settings and component paths in job.audio. Music has an attack and up to 1.35-second fade; boundary effects get a short fade. Regenerate a mix when adjusting components using the existing ffmpeg workflow; preserve prior exports. Pass mix.wav to the unchanged render.mjs --audio. Music and foley use independent random streams. Shared peak attenuation protects the mix; retain stems from the same run when recombining.

## Bundled typography

Paper Cutout includes the optional pairing Manrope 800 + DejaVu Serif Bold Italic 700. Copy both TTFs and both licenses from assets/fonts into each scene's fonts directory. DejaVuSerif-BoldItalic.ttf is the unmodified file from matplotlib v3.10.0, lib/matplotlib/mpl-data/fonts/ttf; its upstream license is DejaVu version_2_37 LICENSE (Bitstream Vera terms, DejaVu additions public domain). Manrope retains OFL.txt. These local font files work without system-font installation on Windows/Linux. Verify Cyrillic including Ё/ё/Й/й when previewing; do not infer coverage from a successful load alone.

Keep reference-based/user font choices available. Unless the user supplies their own font, choose only openly licensed fonts with Cyrillic coverage, bundle files/licenses and explicitly load every used face. Never depend on system fonts for scene typography.

Run from the destination project root. `<skill>` means the folder containing SKILL.md; absolute paths work even if the folder name/location differs.

Install the pinned dependency locally: `npm ci --ignore-scripts --prefix "<skill>/scripts"`, then `& "<skill>/scripts/setup.ps1"`. No browser download or global installation. MOTIONLAB_FFMPEG may point to ffmpeg.exe, MOTIONLAB_BROWSER to Edge/Chrome. Node.js 22+ required. If OS execution permissions prevent temporary browser startup, use execution approval; do not disable browser protection.

Read [projects.md](projects.md) first. Examples below use `projects/Пролёт по коридору/`; create that project and its job.json before producing media.

Reference:
`node "<skill>/scripts/reference.mjs" --in <local-video> --out "projects/Пролёт по коридору/референс-01" --start 0 --end 5 --fps 10 --brief <requirements>`

Accepts video or local PNG/JPEG/WebP/BMP/TIFF; optional --roles typography,palette records reference roles. Run once per source for mixed sets. Images decode one frame; video flags remain unchanged. Creates reference.json, analysis.md and child кадры/ and листы/ inside the requested output directory. Fill actual analysis after viewing PNGs. The script saves a hash and extracted evidence, not an archival copy: the agent first copies required originals into the video project. At 10 fps time resolution is around 100 ms. Use 25–30 fps for short fast movement. For custom frame limits run frames.mjs directly and then sheet.mjs.

Preview manifest JSON (scene paths relative to manifest file; absolute paths accepted):
```json
[
 {"name":"A — clear and calm","description":"Manrope 800/500; blue accent; open layout","source":"сцена/a.html","times":[1.8]},
 {"name":"B — bold","description":"Manrope 800/500; warm accent; large typography","source":"сцена/b.html","times":[1.8]},
 {"name":"C — restrained","description":"Manrope 800/500; neutral palette; strong spacing","source":"сцена/c.html","times":[1.8]}
]
```

`node "<skill>/scripts/preview.mjs" --in <manifest.json> --out "projects/Пролёт по коридору/версии/01/превью-01"`

Renders 1–3 actual stills per view, 1–3 views. Creates contact-sheet.png (A/B/C, preserving proportions), index.html gallery, preview.json and child вариант-1/ etc. with PNGs. Open gallery locally and embed PNGs in chat; inspect them first. No MP4 is rendered. For storyboard use a single selected source with times covering 2–3 meaningful phases. A time must be >=0 and less than scene duration. Preview approval metadata starts pending; the agent records the actual user's decision in job.json.

Single-scene stills are also available: `node "<skill>/scripts/render.mjs" --in <scene.html> --out "projects/Пролёт по коридору/версии/01/кадры-01" --stills 0.3,0.8,1.8`.

Final render, after storyboard approval:
`node "<skill>/scripts/render.mjs" --in <scene.html> --out "projects/Пролёт по коридору/версии/01/рендер-01" --job <job.json>`

With --job, MP4 rendering refuses jobs whose stage is not approved, approval.message is empty, or approval.source (relative to job.json) does not resolve to the input scene. This checks saved state, not authenticity of a chat message; never manufacture approval. The low-level renderer also supports direct invocation without a job for explicit standalone renders/tests; the studio workflow MUST supply --job. Optional --audio <local file> adds audio padded/trimmed to video length; default silent. Returns video.mp4, PNGs, frames.json and render.json. The loopback server serves only the scene directory, not the project or skill.

Review:
`node "<skill>/scripts/sheet.mjs" --frames "projects/Пролёт по коридору/версии/01/рендер-01" --out "projects/Пролёт по коридору/версии/01/листы-01"`
`node "<skill>/scripts/compare.mjs" --ref "projects/Пролёт по коридору/референс-01/кадры" --clone "projects/Пролёт по коридору/версии/01/рендер-01" --out "projects/Пролёт по коридору/версии/01/сравнение-01"`

Comparison provides global activity, not an automatic fidelity score. Complete review.md with visual per-object findings. Respect changes in branding and output dimensions.

Outputs: new directories inside projects/<working title>/ only, with checked non-link parents; no cleanup or overwrite. Analyse up to 120 seconds/1200 frames/1920 width (defaults 10 seconds/600 frames/800 width). Render up to 120 seconds/3600 frames/60 fps, even dimensions <=1920 each side. Split long projects into scenes; intermediates consume disk. These are workflow bounds, not strict peak-memory limits of decoders.
