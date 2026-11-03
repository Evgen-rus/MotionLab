# Workbench redesign

Mode: operate. Platform: local web, primarily Chrome desktop.

## Direction contract

User pinned the two Stitch references and rejected macOS window buttons. Their 2026-11-02 message explicitly delegates design choice, testing and completing the working version, commit and push. Seed aaf77564 assigned grounded candidate 4; the pinned reference takes precedence. The grounded options were film cutting desk, broadcast monitor wall, audio console, compact NLE workspace, photo contact sheet, production slate and screening room. Build the compact NLE workspace within the supplied neutral dark three-pane grammar. Catalog challengers do not supersede a pinned professional editing grammar: pure monochrome, red dense portals, paper reference layouts, star atlases, letter specimens and vertical feeds obscure the editing task or conflict with the supplied reference. Keep their discipline of legible time data, restrained controls and fixed region structure, without introducing their styles.

Chosen comp: `.impeccable/mocks/workbench-b.png` (B). Choice delegated by user; recorded in prompt sidecar. Three comps were generated and inspected. B offers the clearest direct import and trim hierarchy. No further approval is required by the user's explicit delegation.

FIRST VIEWPORT: 58px application header, left library (roughly 22% upper workspace), flexible large central monitor, right inspector (roughly 22%), lower timeline with detached audio and a compact local-status footer. At standard desktop widths all editing regions remain visible. Blue indicates selection/transport/export; green indicates detached audio/local state. Neutral near-black panels, restrained borders, 12–14px body, distinct 15–18px section titles. Smaller screens reflow without horizontal page overflow.

Signature interaction: selection leaves the playhead in place; scrub the ruler to seek, drag selected clip edges to trim, or enter source-relative boundaries in the inspector. Video stays a sequential track; detached audio moves independently, with overlapping audio on separate visual rows. Undo/redo spans the last 30 edits, including CLI changes and imports. Changes from Codex CLI appear through revision refresh.

Do not literalize the generated image's invented 4K/FPS, fake file counts or synthetic architectural footage. All metadata comes from actual state. The user removed the duplicate command strip on 2026-11-03: text requests go to Codex chat, direct editing stays in Workbench. The approved 2026-11-03 prototype adds detached audio, gain, tempo, trim handles, undo/redo and safe library removal. Use the user's own video thumbnails in the library. No cloud claims, unimplemented mode tabs, macOS traffic lights or externally loaded scripts/fonts. Removing a material keeps the file and is blocked while any video/audio fragment uses it.

## Scope

2026-11-04 approved addition: keep both modes inside Workbench. “Монтаж” retains all footage/audio tools; “Структура сцены” shows the actual authored HTML, named scenes/elements, a scaled interactive frame, real seek playback, appearance/motion context and element timing rows. A single “Скопировать элемент” action copies source/revision/element identity for the chat; there is no request input. Preserve the incumbent visual grammar. The scene viewer is read-only and sandboxed; selecting or playing it never updates edit.json, job approvals or original files. New authored scenes use explicit stable data-element-id/data-scene-id metadata; no migration of old test scenes is required. Imported MP4s remain footage and never acquire invented layers.

Retain server and CLI contracts, existing projects, approval rules for authored HTML scenes, source files and exports. Improve existing UI and correct defects found in required checks. Do not introduce a framework, dependency or automatic media cleanup. All reference media, comps, screenshots and engine state stay local and ignored by Git.
