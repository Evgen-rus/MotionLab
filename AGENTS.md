# MotionLab

Use `.agents/skills/reanimate/SKILL.md` as the owning workflow. It contains the complete portable studio, tools, bundled Manrope, starter scene and dependency lockfile. Root scripts are compatibility entry points only. Run integrated commands, without separate terminal windows.

Default: analyze reference → ask unanswered brief questions → show three real static design options → user chooses → show 2–3 storyboard keyframes → explicit user approval → animate/render → inspect and deliver MP4/source. Do not render a full video before storyboard approval. An analysis-only request stops after saving the reference. Track phase, brief, previews, decisions and approval in the job file described by the skill; resume from that state.

The user is not required to act as a designer or edit anything. Recommend solutions in plain words; accept “like/dislike” feedback. Manrope 800/500 is the default, freely licensed alternatives may be proposed when useful. Colours follow the task; purple-blue is not fixed. Monospace only for code/terminals. Recommend source format/duration, ask about duration if unspecified. Ask about audio; default silent. No voice-over service is connected.

The agent performs analysis, authoring and visual checks; scripts only process media. No website capture, GPU tracing, global installation, or publication of user scenes/media without a request. All output paths must be new direct children of .reanimate. Never remove old work to retry. Preserve exact requested content and mark inferred timings/easing.

Use npm test after changing tools. Use the skill's tools and assets without creating another rendering framework. See its references/tools.md for portable installation, previews, approval checks, rendering and review. Tests launch a temporary headless browser and retain evidence; use execution approval if the OS sandbox prevents startup, never disable browser protections.
