# Visual-first decisions

## Smart intake
Read the request, attachments and job before asking. Ask only missing answers in small groups with concrete choices and free text: purpose/main message/CTA, audience, platform AND placement, duration, sound. Tailor audience choices to the subject (e.g. general viewers, developers, business). Adapt copy, pacing, complexity, visual direction and sound to that audience. Do not make the user supply a professional brief.

Show three actual previews for unresolved creative decisions, labelled A/B/C, each with a name and 1–2 plain sentences, and recommend one with a reason. Use preview.mjs for a contact-sheet.png; inspect it and embed the absolute image path in chat. Link the gallery and full-size individual PNGs. Accept combinations, three new choices or delegated selection. Do not make images for questions where they add nothing. Do not render full videos for choices.

Show three appropriate aspect ratios as honest frames with the intended copy inside; offer other ratios optionally. Telegram channel posts do not imply vertical Stories. HD vs Full HD is a size/clarity/speed decision, not a fake stylistic difference:

| Ratio | HD | Full HD |
|---|---|---|
| 9:16 | 720×1280 | 1080×1920 |
| 16:9 | 1280×720 | 1920×1080 |
| 1:1 | 720×720 | 1080×1080 |
| 4:5 | 720×900 | 1080×1350 |

Offer exact sizes; do not silently pick Full HD. Renderer allows even dimensions 64–1920 each side, duration 0.1–120 seconds, 1–60 FPS, maximum 3600 frames. Propose three suitable durations if unknown; recommend 30 FPS, explain 24/60 only when useful. Verify current official platform requirements only when exact publication limits matter. Summarize goal/audience, platform/placement, ratio/size, duration/FPS, reference roles and unresolved creative choices. Wait for required answers.

## Local mixed references
Accept local PNG/JPEG/WebP/BMP/TIFF screenshots/images and video, in any combination. Run reference.mjs once per source, each in a new directory; --roles typography,composition (or motion,timing,palette,texture,transitions,mood,layout) records intent. Inspect every source and explain what to borrow; ask only if ambiguous. A still provides no evidence of motion. Assign multiple roles freely. Keep the legacy job.reference unchanged; new jobs use references entries {source, manifest, roles, analysisStatus}, relative to job.json. Old jobs without new fields remain valid; infer missing fields on resume, never demand migration.

Use motion from video and typography/paper panels from a screenshot to create an original composition. Explain limits for realistic footage, complex 3D or unavailable effects and offer a feasible graphic interpretation. Never promise exact reconstruction or copy third-party assets into the skill.

## Typography and directions

Unless the user supplies a font, use only openly licensed fonts with Cyrillic coverage. Bundle and explicitly load every needed face; system-font installation is never a scene dependency. Paper Cutout has a ready pairing of Manrope 800 and DejaVu Serif Bold Italic 700 (both bundled with licenses); other reference-based choices remain available.
Offer source choices when unspecified: A derive from reference, B automatic pairing, C user's local font. For reference fonts describe serifs, weight, width, contrast, scale and panel treatment; label uncertain matches as approximations. Automatic selection needs three real samples of the SAME phrase, rendered in the proposed fonts and weights, on one PNG sheet. Use task copy including Cyrillic. Load TTF/OTF/WOFF/WOFF2 via local @font-face and explicit document.fonts.load checks as in scene.html. Check Cyrillic glyphs visually (including ё/Й); font-load success alone does not prove glyph coverage. Check licenses; retain license files with copied fonts, never fetch paid fonts or silently substitute. Manrope remains the bundled fallback; if a choice is unavailable, explain and show alternatives before continuing.

Create task-specific directions, not a fixed catalogue. assets/paper-cutout.html is one authored example: irregular paper panels, contrasting serif/sans typography, cut-out shapes, collage, subtle shadows and procedural texture. Pair short paper movements with independently editable rustle/click accents if sound is requested. Paper Cutout is a style, not a font or mandatory direction. Other styles should differ in composition and hierarchy, not merely tint.

## Sound and approval

Local procedural synthesis is available via `scripts/synth_audio.py`; see tools.md. This is one optional source of synthetic sketches, not professional or realistic music. When selecting sound, generate three short playable previews where possible, varying tempo, mood and instruments to suit the brief. Keep the existing approval and mixing workflow.
Skip this stage for silent videos. If sound is wanted but music is unspecified, offer three suitable musical directions. Provide actual short playable local previews when available, using absolute Markdown audio embeds. Text descriptions are not audio previews. Without a music tool or licensed tracks, say so and ask for a local track or offer a clearly labelled synthesized sketch; never imply generated music exists or connect a paid API.

After design selection, propose effects at concrete screen actions/times. Keep original music, individual effect files (with time, gain and enabled state) and final mix separate in job.audio. Use existing ffmpeg for local mixing: trim/loop music to duration, apply gain/fades, delay enabled effects with adelay, combine with amix and limit peaks with alimiter. Preserve component files and the exact command/settings in the job so replacing music or muting an effect only requires remixing; mux with the existing cached silent MP4 where available, no graphics rerender. Do not overwrite previous exports.

Listen to start/transitions/end, measure peaks with ffmpeg astats/volumedetect, check effects do not mask music, fade the ending and verify duration/synchronization. Padding with silence alone does not fix an abrupt musical ending. Supply the completed mix via render.mjs --audio. Final user video is MP4; WAV/MP3 intermediates are allowed.

Show 2–3 storyboard keyframes from the selected authored scene, explain movement, then summarize all decisions including sound and ask for final render approval. Only explicit fast-mode delegation bypasses intermediate questions; save that actual message, chosen assumptions and scene path using the existing approval contract. On edits preserve unrelated answers/components and prior revisions. New styles do not reset audience/format; font-only edits do not restart intake; audio-only edits reuse graphics. Clear approval for changed content and obtain only the necessary revised approval.
