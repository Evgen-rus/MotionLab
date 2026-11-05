# MotionLab

For reference analysis and video creation, read and follow `.agents/skills/motionlab/SKILL.md`. It owns the complete workflow, defaults, tools, preview/approval stages and delivery requirements; do not duplicate or replace it with a new framework. Work through the agent; the user only supplies a brief, visual feedback and approval.

Use integrated execution tools and preserve command output; do not open separate terminal windows. Runtime setup is in the skill's references/tools.md. Nothing is installed globally. Keep generated work local and never publish user media/scenes without a request.

For changes to tools, run `node --test tests/*.test.mjs` from this root after installing the skill's pinned dependency. Tests launch a temporary headless browser; use execution approval when required, not disabled browser protection. Do not create audit/verification logs, duplicate root packages or compatibility wrappers. Keep necessary licenses with the skill and font.

В проекте доступна необязательная библиотека `motion-design-library/`. Для динамичных роликов, заголовков и сложных переходов агент может читать подходящие рецепты и, если это улучшит результат, кратко предложить 1–3 варианта с объяснением визуальной разницы. Предложения необязательны: не упоминайте библиотеку при каждом запросе, не применяйте эффекты автоматически и не добавляйте этапов согласования. При явном запросе конкретного приёма прочитайте его рецепт и реализуйте в существующей архитектуре MotionLab. Художественный выбор пользователя имеет приоритет.
