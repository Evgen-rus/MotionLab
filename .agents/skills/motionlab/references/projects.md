# Named video projects and revisions

Ask: «Как назовём ролик для рабочей папки? Лучше коротко и понятно, например “Пролёт по коридору”.» If the brief already names it, reuse that title without asking again. Prefer Russian, but do not translate a user's chosen English title. Use the title itself, with spaces and Cyrillic preserved. Replace only filesystem-invalid characters; avoid Windows reserved names and trailing dots/spaces. Keep the original title in job.json. If a folder already exists, inspect its job.json and clarify whether this is a continuation or a different video; never overwrite or silently merge them. A separate video with the same title can use a descriptive suffix.

## One folder per video, across chats

```text
projects/
  Пролёт по коридору/
    job.json
    исходники/
    референс-01/
      reference.json
      analysis.md
      кадры/
      листы/
    версии/
      01/
        сцена/
        варианты.json
        превью-01/
        рендер-01/
        сравнение-01/
    готовое/
      Пролёт по коридору-v01.mp4
```

Create the project directory exclusively with freshOutput from scripts/lib.mjs (or equivalent checked exclusive mkdir). Write a copy of assets/job.example.json to its job.json, set title and revision=1, and add the first versions entry. Create subfolders only when needed. Scripts run from the destination repository root; quote paths with spaces. All generated artifacts, including helper scripts and audio, belong inside this video folder. Never scatter new scenes into root animations/ or outputs into .motionlab/.

Copy the supplied original video, logos, audio and other required assets into исходники/ without overwriting. Record their relative paths in sources. Preserve user originals outside the project. Reuse a previously saved local reference when supplied, but copy required assets into this project if needed to make it self-contained. Do not archive unrelated external folders.

Use paths relative to the video folder in job.json: reference, previews, approval.source, exports and version entries. Preview manifest sources are relative to their manifest. CLI paths are relative to the repository cwd; resolve job paths against the job.json directory before passing them to tools. Tool-generated diagnostics may contain absolute paths; they can be regenerated and are not the resume index. Scene resources must be local to the scene directory, as required by the renderer's server. If a scene relies on decoded PNGs, fonts, video or audio, those files are source dependencies, not disposable cache.

## Continue editing without losing previous work

Read job.json and the latest version's scene before doing work. Keep revision as the current version number. Each versions entry records its number, change summary, relative scene path, approval (including the user's message), and export path when available. Record audio paths and render settings/command relative to this folder as well, so deleting reproducible frames does not lose the recipe. Update the current stage, brief, decisions and deliverables in job.json as usual. At delivery, link both the MP4 and the video folder so a user can find the editable project later.

For requested edits after delivery or approval, save the previous version's approval and export in versions, create версии/02/ (then 03, etc.), and copy the chosen scene with all its local dependencies there before editing it. Reuse unchanged originals/reference analysis. Clear current approval and set the appropriate preview stage; show changed design/content for approval according to SKILL.md. Never present approval for version 01 as approval for version 02. Technical fixes before delivery can use new attempt folders in the same version. Preserve the actual approved message and scene path for each version. Final exports get distinct names such as «Пролёт по коридору-v02.mp4»; never overwrite v01.

## Cleanup on request

Do not delete material automatically at delivery. Explain the two useful cleanup choices when asked:

- Keep the ability to edit: retain job.json, original media, all retained versions' scene dependencies and audio, reference analysis, preview manifests and approved previews, final exports. Rendered PNG sequences and other reproducible diagnostics can be removed after checking that no scene references them and that the export exists. Keep the render settings or command needed to recreate them.
- Remove a whole video: delete its single project folder only when the user requests that scope. Explain that this also removes editable sources and all versions. Offer to copy final MP4s outside first if the user wants to keep them.

Before deleting, verify the resolved paths are inside the intended video folder and reject links escaping it. Never infer that a source asset is disposable from its extension or folder name alone. Do not claim an MP4 by itself is an editable archive.
