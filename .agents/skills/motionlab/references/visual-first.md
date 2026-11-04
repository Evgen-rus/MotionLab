# Visual-first decisions

## Intake: ordinary or deep

At each new video brief, offer «Обычный бриф — уточним необходимое и перейдём к оформлению» and «Глубокий разбор — проработаем идею, зрителя, начало, развитие, визуальный подход и звук». Wait for the user's selection unless already supplied for this brief; never infer the depth from complexity or silence. For deep intake, also read [deep-intake.md](deep-intake.md). The requirements below apply to both modes; ordinary intake keeps questions to the essentials. Existing projects and concrete editing requests do not need a fresh mode choice.

Read the request, attachments and job before asking. Ask only missing answers in small groups with concrete choices and free text: purpose/main message/CTA, audience, platform AND placement, duration, sound. Tailor audience choices to the subject (e.g. general viewers, developers, business). Adapt copy, pacing, complexity, visual direction and sound to that audience. Do not make the user supply a professional brief.

Audience is required: obtain an explicit user answer before designing, or reuse their explicit answer for this brief. Use `request_user_input_async` when available, with 2–3 tailored suggested answers and free text, in groups of up to three questions. Offer “помоги выбрать” when useful; never leave a missing decision as an open-ended demand for a professional brief. Cover these three blocks, asking only unanswered items and tailoring examples to the video:

| Block | Establish | Example suggested answers |
|---|---|---|
| Who and why | Audience, familiarity with the subject, their relevant need; purpose and intended viewer action | Potential clients / current users / internal team; introduce / explain / sell; write to us / try it / no call to action |
| Idea and boundaries | Main message or offer, supported facts, reference roles/style, required assets/text and things to avoid | Show the process / show the benefit / compare before–after; use supplied assets / create original graphics / combine; brand rules / file-size or deadline limits / no extra restrictions |
| Deliverable | Platform AND placement, orientation/size, duration, number/variants, narration/subtitles, music/effects, final files and whether editable sources are needed | Telegram post / Stories / presentation; vertical / horizontal / square with exact pixels; silent / voice / voice + music; one video / several variants |

Do not invent an offer, target-audience pain, product claim or CTA. For a non-marketing piece, use its actual communication goal instead of forcing a sales framework. Show actual visual/audio samples at their later selection stages. Save purpose/audience/content/format in job.brief, plus message, CTA, constraints and requested outputs; a blank or inferred audience is not ready for production. Bring all answers forward into final confirmation, including deliberately omitted sound or CTA.

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

In each source's analysis.md record what to borrow, what not to copy, and where the borrowed style/motion will appear in our storyboard. Distinguish full-frame graphic style from a reference thumbnail, and depth from a physical device prop. When a term is ambiguous, show one representative still before building the whole sequence. Include these reference-to-scene choices in the final summary.

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

For narration, retain the original voice and a voice-only stem aligned to the exact final timeline. Check both for silence, then check the decoded final MP4 against that aligned stem with check-audio.mjs (tools.md), including after compression/remuxing. A failure blocks delivery; fix the mix, not just its overall gain. Numeric checks do not establish pronunciation or pleasantness: listen when audio perception is available, otherwise state that listening was not performed. Record checks and remaining limitations in job.audio.

## Focused review and production summary

Before final confirmation, use the local Impeccable visual-design guidance for a focused review of the actual storyboard/scene and all reference-to-scene choices. Inspect reference stills alongside our frames, not just the written analyses. Review composition, typography, phone-size readability, palette, depth, transitions and before/after clarity against the brief. Reuse its applicable critique/polish guidance; this is a motion-artwork review, not a full UI audit. Do not run unrelated commands, produce Nielsen tables, or impose Workbench UI tokens on video artwork. If a full `impeccable critique` is explicitly requested, follow that command's own workflow. Fix defects and inspect revised stills before presenting them. If Impeccable is unavailable, disclose it and ask before substituting another review; do not silently skip the requested critic. Review improves craft but cannot guarantee that every viewer will like the result.

Present a short summary in plain Russian before EVERY new final video or batch, including audio-only revisions. Include:
- Goal, audience and familiarity, main message/offer, CTA (or none), constraints, platform and placement.
- Explicit orientation, aspect ratio, pixel dimensions, duration and FPS; “Telegram” alone determines none of these.
- Reference roles and scene sequence, selected style, transitions and readable sample frames.
- Exact narration text, selected voice/provider, music preview and enabled effects, or explicitly “без звука”.
- Number of outputs and each variant's differences; for a batch use one compact table with shared settings stated once.
- Critic's important fixes and any unresolved limitations (e.g. editor screenshot versus recorded actions).

Ask for confirmation or corrections and wait; a prior request to generate everything is not confirmation of this unseen summary. Store it in job.decisions and preserve the actual confirmation in the existing approval fields. A changed format, audience, scene, wording or sound requires an updated summary; fixing a defect without changing the confirmed result does not. Preserve unrelated answers, reuse graphics for audio-only edits, and never restart intake unnecessarily. Agent-initiated Workbench exports follow the same summary rule; manual UI export controls are unchanged.
