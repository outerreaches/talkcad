# Security Policy

TalkCAD runs OpenSCAD files and model output, and talks to third-party LLM providers with a key
stored on your machine. Reports about the app's own boundaries are taken seriously.

## Reporting a vulnerability

Email **security@talkcad.app** with:

- the version or commit you tested,
- your platform,
- steps to reproduce,
- and what an attacker gains.

Please do not open a public issue for a suspected vulnerability. You will get an acknowledgement
within a few days. If the issue is confirmed, a fix is prepared privately and a release is published
before the details are discussed in public.

## Scope

In scope:

- the Electron main/renderer boundary (IPC handlers, preload bridge, filesystem access),
- handling of LLM output (tool calls, generated code, fetched web content),
- credential storage,
- the packaging and auto-update path.

Out of scope:

- vulnerabilities in OpenSCAD itself (report those upstream),
- behaviour that requires an already-compromised OS account,
- the security of the models you choose to run or call.

## What the app does to reduce exposure

- The renderer runs with `contextIsolation`, without Node integration, and inside a sandbox.
- Filesystem IPC is limited to the projects directory and folders opened through a native dialog;
  paths are resolved (including symlinks) before the check.
- Navigation away from the app bundle is blocked, `window.open` is denied, and OS permissions are
  refused by default.
- Web fetches from the research tools reject private, loopback and link-local addresses on every
  redirect hop, and are bounded in size and time.
- The API key is encrypted with the OS keychain when one is available.
- The build ships a Content-Security-Policy and bundles Monaco locally instead of loading it from a
  CDN.
