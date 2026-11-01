# Changelog

All notable changes to TalkCAD are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.1] — 2026-10-31

### Security

- Filesystem IPC is restricted to the projects directory and folders opened through a native
  dialog; paths (including symlinks) are resolved before the check.
- Added a Content-Security-Policy; Monaco is bundled with the app instead of being loaded from a
  CDN at runtime.
- The main window is sandboxed, navigation away from the app bundle is blocked, `window.open` is
  denied and OS permission requests are refused.
- The API key is encrypted at rest with the OS keychain (`safeStorage`) and migrated on first start
  when a keyring is available.
- Research fetches reject private, loopback and link-local addresses on every redirect hop, and are
  bounded in time and response size.
- Spec expression evaluation no longer uses `new Function`; a small parser handles numbers,
  operators, context variables and a fixed function set.
- Electron 32 (end of life) upgraded to 45.2.1.

### Added

- Unit tests (vitest) for the expression evaluator, granted-path checks and path helpers.
- CI workflow: typecheck, lint, tests, production build and a production dependency audit.
- `SECURITY.md`, `CONTRIBUTING.md`, this changelog, and an issue template.
- Screenshots in the README and application icons.

### Fixed

- Startup no longer blocks when the desktop keyring does not answer; the availability probe is
  bounded and falls back to unencrypted storage with a warning.

## [0.1.0] — 2026-02-06

First public release: conversational OpenSCAD modelling with multi-agent research, verification,
live preview and STL export.
