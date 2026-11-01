# Contributing to TalkCAD

Thanks for taking a look. This is a small project, so the most useful contributions are focused bug
reports, small fixes, and additions to the design knowledge base.

## Getting set up

```bash
pnpm install
pnpm dev
```

You also need [OpenSCAD](https://openscad.org/downloads.html) installed — the app shells out to it.

Before opening a pull request:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter talkcad-desktop exec vite build
```

These are the same checks CI runs.

## Where things live

- `apps/desktop/src` — React renderer: components, stores, the agent loop and tools.
- `apps/desktop/electron` — main process: window, IPC handlers, OpenSCAD runner, config.
- `resources/skills` — the design knowledge base (markdown). Adding a well-sourced skill is one of
  the highest-leverage contributions.
- `packages/shared` — types shared by the app and the CLI.

## Rules of thumb

- Keep the renderer sandboxed: no new direct Node access, no new IPC that takes arbitrary paths.
- New IPC handlers must validate their inputs the way the existing ones do (`assertGrantedPath`,
  `resolveWithin`, URL checks).
- Prefer adding a skill over hard-coding a special case in a prompt.
- Describe the behaviour you changed in the pull request; screenshots help for UI changes.

## Reporting bugs

Include the app version, OS, the model/provider you used, and — if the agent misbehaved — the
session's `chat.json` from `<userData>/projects/<id>/` (strip anything private first).
