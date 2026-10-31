# Portable tools

Run from the destination project root. `<skill>` means the folder containing SKILL.md; absolute paths work even if the folder name/location differs.

Install the pinned dependency locally: `npm ci --ignore-scripts --prefix "<skill>/scripts"`, then `& "<skill>/scripts/setup.ps1"`. No browser download or global installation. MOTIONLAB_FFMPEG may point to ffmpeg.exe, MOTIONLAB_BROWSER to Edge/Chrome. Node.js 22+ required. If OS execution permissions prevent temporary browser startup, use execution approval; do not disable browser protection.

Reference:
`node "<skill>/scripts/reference.mjs" --in <local-video> --name <unique-id> --start 0 --end 5 --fps 10 --brief <requirements>`

Creates .motionlab/<id>-reference/{reference.json,analysis.md}, <id>-frames and <id>-sheets. Fill actual analysis after viewing PNGs. Original video must remain accessible; the hash and extracted evidence are saved, not an automatic archival copy of the entire source. At 10 fps time resolution is around 100 ms. Use 25–30 fps for short fast movement. For custom frame limits run frames.mjs directly and then sheet.mjs.

Preview manifest JSON (scene paths relative to manifest file; absolute paths accepted):
```json
[
 {"name":"A — clear and calm","description":"Manrope 800/500; blue accent; open layout","source":"../../animations/job/a.html","times":[1.8]},
 {"name":"B — bold","description":"Manrope 800/500; warm accent; large typography","source":"../../animations/job/b.html","times":[1.8]},
 {"name":"C — restrained","description":"Manrope 800/500; neutral palette; strong spacing","source":"../../animations/job/c.html","times":[1.8]}
]
```

`node "<skill>/scripts/preview.mjs" --in <manifest.json> --out .motionlab/<job>-options-01`

Renders 1–3 actual stills per view, 1–3 views. Creates index.html gallery, preview.json and sibling <out>-v1 etc. with PNGs. Open gallery locally and embed PNGs in chat; inspect them first. No MP4 is rendered. For storyboard use a single selected source with times covering 2–3 meaningful phases. A time must be >=0 and less than scene duration. Preview approval metadata starts pending; the agent records the actual user's decision in job.json.

Single-scene stills are also available: `node "<skill>/scripts/render.mjs" --in <scene.html> --out .motionlab/<job>-stills --stills 0.3,0.8,1.8`.

Final render, after storyboard approval:
`node "<skill>/scripts/render.mjs" --in <scene.html> --out .motionlab/<job>-render-01 --job <job.json>`

With --job, MP4 rendering refuses jobs whose stage is not approved, approval.message is empty, or approval.source does not resolve to the input scene. This checks saved state, not authenticity of a chat message; never manufacture approval. The low-level renderer also supports direct invocation without a job for explicit standalone renders/tests; the studio workflow MUST supply --job. Optional --audio <local file> adds audio padded/trimmed to video length; default silent. Returns video.mp4, PNGs, frames.json and render.json. The loopback server serves only the scene directory, not the project or skill.

Review:
`node "<skill>/scripts/sheet.mjs" --frames .motionlab/<job>-render-01 --out .motionlab/<job>-sheets-01`
`node "<skill>/scripts/compare.mjs" --ref .motionlab/<reference>-frames --clone .motionlab/<job>-render-01 --out .motionlab/<job>-compare-01`

Comparison provides global activity, not an automatic fidelity score. Complete review.md with visual per-object findings. Respect changes in branding and output dimensions.

Outputs: new direct children of .motionlab only; no cleanup or overwrite. Analyse up to 120 seconds/1200 frames/1920 width (defaults 10 seconds/600 frames/800 width). Render up to 120 seconds/3600 frames/60 fps, even dimensions <=1920 each side. Split long projects into scenes; intermediates consume disk. These are workflow bounds, not strict peak-memory limits of decoders.
