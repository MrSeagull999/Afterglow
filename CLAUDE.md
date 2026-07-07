# AfterGlow — dev notes

Electron (electron-vite + electron-builder) + React/TS app for AI photo
editing (sky replacement / staging via Gemini image models). The owner mainly
uses the jobs/inspector flow as a nano-banana interface; the legacy runs/CLI
flow is slated for removal.

## Build & install

- Dev: `npm run dev`. Packaged app: `npm run dist:mac`, output lands in
  `~/.cache/afterglow-release/mac-arm64/AfterGlow.app` — the output dir is
  redirected off this ExFAT volume because `.app` bundles contain symlinks
  ExFAT can't store. Install by `ditto` to `/Applications/AfterGlow.app`.
- API keys come from `.env` in the project root, bundled via
  `extraResources` into `Contents/Resources/.env`.

## Packaged-vs-dev paths

- Anything cwd-relative breaks when packaged (cwd is `/`). Settings, runs,
  and prompt-bank all resolve via `app.isPackaged ? resourcesPath|userData :
  app.getAppPath()` — follow that pattern for new file access.
- Job data lives in `userData` (`~/Library/Application Support/afterglow`),
  shared between dev and packaged builds.

## Open-with / Lightroom "Edit In"

- Files arrive via macOS `open-file` events, argv, or `second-instance`
  argv; all funnel into `queueOpenFiles` in `src/main/index.ts`, which
  debounces multi-select opens into one batch. The renderer drains the queue
  through `openFiles:getPending` (on mount and on the `openFiles:pending`
  ping) and shows `ImportFilesModal` (new project vs add-to-existing).
- Import reuses `createAsset` and re-emits `watchFolder:newAssets` so an
  open JobPage refreshes.
- Single-instance lock is required — don't remove it, or LR opens spawn a
  second app that fights over port 3737.
