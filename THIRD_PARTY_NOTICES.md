# Third-party notices

MotionLab includes adaptations of reanimate by Niaz Morshed:
https://github.com/NiazMorshed2007/reanimate
Source snapshot: 522a353be364828ef43e1440faf5c1077edccbc1.

The local-video workflow and frames/sheet tools derive from that project.
scripts/render.mjs adapts the time-based seek/screenshot/ffmpeg mechanism and
BT.709 encoding from site/video/scripts/render.ts; .agents/skills/reanimate/assets/scene.html uses the
window.__video seek contract from site/video/src/main.js. The demo design,
text and scenes here are new; upstream music and demo assets are not included.
references/implementation.md is retained from upstream. The original MIT
notice is preserved in .agents/skills/reanimate/LICENSE. MotionLab changes
are also MIT licensed; see the root LICENSE.

playwright-core is a pinned npm dependency under its own Apache-2.0 license;
its package includes the license. Node.js, Edge/Chrome and ffmpeg are external
prerequisites and are not redistributed here.
Their respective licenses apply to those programs.

Manrope font in .agents/skills/reanimate/assets/fonts/Manrope-Variable.ttf is
Copyright 2018 The Manrope Project Authors (https://github.com/googlefonts/manrope),
licensed under SIL Open Font License 1.1. The full notice is retained in
.agents/skills/reanimate/assets/fonts/OFL.txt. This font is not covered by MotionLab's MIT license.
Source: https://github.com/google/fonts/tree/main/ofl/manrope
