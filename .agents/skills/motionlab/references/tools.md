# Portable tools

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
