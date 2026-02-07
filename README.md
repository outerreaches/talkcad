# TalkCAD

A conversational CAD interface where users describe 3D objects in natural language, and an LLM generates, refines, and iterates on OpenSCAD code with live preview.

## Features

- **Natural Language Interface** — Describe what you want to create in plain English
- **Live 3D Preview** — Real-time STL rendering with orbit controls, wireframe mode, and axis visualization
- **Multi-Agent Architecture** — Orchestrator, Builder, and Researcher agents work together
- **Automatic Verification** — Code and visual verification to ensure specs are met
- **Spec Tracking** — Explicit and inferred specifications with verification status
- **Knowledge Base** — Built-in skills library with design rules, techniques, and dimensions
- **Web Research** — Integrated web search for finding real-world dimensions and references
- **Image Support** — Attach reference images or capture viewport screenshots

## Prerequisites

### OpenSCAD

TalkCAD requires [OpenSCAD](https://openscad.org/) to be installed on your system.

**Download:** https://openscad.org/downloads.html

#### macOS Setup

After downloading and installing OpenSCAD, macOS Gatekeeper may block the app from running because it cannot verify the developer. You'll see an error like:

> "OpenSCAD-2021.01.app" Not Opened
> Apple could not verify "OpenSCAD-2021.01.app" is free of malware...

**To fix this, use one of these methods:**

**Option 1: Right-click to Open (Recommended)**
1. Open Finder and navigate to `/Applications`
2. Right-click (or Control-click) on `OpenSCAD-2021.01.app`
3. Select "Open" from the context menu
4. Click "Open" in the security dialog that appears

This only needs to be done once. macOS will remember your choice.

**Option 2: Terminal Command**
```bash
xattr -d com.apple.quarantine /Applications/OpenSCAD-2021.01.app
```

**Option 3: System Settings**
1. Open **System Settings** → **Privacy & Security**
2. Scroll to the "Security" section
3. Look for the message about OpenSCAD being blocked
4. Click **"Open Anyway"**

#### Expected Installation Paths

TalkCAD auto-detects OpenSCAD at these locations:

| Platform | Paths |
|----------|-------|
| **macOS** | `/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD`, `/opt/homebrew/bin/openscad`, `/usr/local/bin/openscad` |
| **Windows** | `C:\Program Files\OpenSCAD\openscad.exe`, `C:\Program Files (x86)\OpenSCAD\openscad.exe` |
| **Linux** | `/usr/bin/openscad`, `/usr/local/bin/openscad`, `/snap/bin/openscad` |

If OpenSCAD is installed elsewhere, you can set the path manually in Settings.

## Getting Started

```bash
# Install dependencies
pnpm install

# Run the desktop app
cd apps/desktop
pnpm dev
```

### API Key Setup

TalkCAD requires an LLM provider. The default is OpenRouter, which provides access to multiple models.

1. Get an API key from [OpenRouter](https://openrouter.ai/keys)
2. Open TalkCAD and go to **Settings** (gear icon)
3. Enter your API key and select your preferred model

### Storage locations

TalkCAD stores data in your OS user data directory (Electron `app.getPath('userData')`):

- **Sessions/projects**: `<userData>/projects` (override via `TALKCAD_PROJECTS_DIR`)
- **Config (shared with CLI)**: `<userData>/config.json`
- **User-created skills**: `<userData>/skills`

## User Interface

### Layout

The interface consists of four main areas:

- **File Explorer** (left sidebar) — Browse and manage project files. Toggle with `⌘B`
- **Code Editor / 3D Preview** (center) — View and edit OpenSCAD code or see the 3D preview. Switch with `⌘1` (code), `⌘2` (preview), or use the tabs
- **Specs Panel** (right sidebar) — View extracted specifications and verification status. Toggle with `⌘J`
- **Chat Panel** (bottom) — Converse with the AI agent. Focus with `⌘/`

### View Modes

- **Code** — Full-screen code editor with syntax highlighting
- **Preview** — Full-screen 3D viewport
- **Split** — Side-by-side code and preview

### 3D Viewport Controls

| Action | Control |
|--------|---------|
| Orbit | Click and drag |
| Pan | Right-click and drag |
| Zoom | Scroll wheel |

Viewport toolbar options:
- **Persp/Ortho** — Toggle perspective or orthographic camera
- **XYZ** — Toggle axis gizmo display
- **Solid/Wire** — Toggle solid or wireframe mesh display

The viewport displays render stats including dimensions (mm), manifold status, and triangle count.

### Chat Input

The chat input supports:
- **Text messages** — Describe what you want to create or modify
- **Image attachments** — Click the image icon to attach reference images
- **Viewport capture** — Click the camera icon to attach a screenshot of the current 3D view
- **Keyboard shortcut** — Press Enter to send, Shift+Enter for newline

Quick mode selectors in the input field:
- **Negotiation Level** — How much the agent pushes back on specs
- **Autonomy Mode** — How autonomous the agent operates

## Settings

Access settings via the gear icon in the title bar.

### LLM Provider

Supported providers:

| Provider | Type | Notes |
|----------|------|-------|
| **OpenRouter** | Cloud | Recommended. Access to multiple models (Claude, GPT, Gemini, etc.). **Required for web tools**. |
| **OpenAI** | Cloud | OpenAI-compatible API (proxied through Electron main process to avoid CORS). |
| **Google Gemini** | Cloud | OpenAI-compatible Gemini endpoint (proxied through Electron main process to avoid CORS). |
| **Groq** | Cloud | OpenAI-compatible API (proxied through Electron main process to avoid CORS). |
| **Ollama** | Local | Run models locally |
| **LM Studio** | Local | Local model inference |
| **llama.cpp** | Local | Lightweight local inference |
| **Custom** | Any | Any OpenAI-compatible API (local or remote) |

**Web Access Tools** — Toggle to enable/disable web search and remote fetching. Currently this requires **OpenRouter**.

### Autonomy Modes

| Mode | Description |
|------|-------------|
| **Guided** | User-driven, no automatic research or verification |
| **Researched** | Performs research and builds, but no auto-verification |
| **Verified** | Full loop: research → build → verify → repair |
| **Ralph** | Infinite self-healing loop that clears context and resumes |

**Configurable limits:**
- Max Iterations (Ralph mode restarts)
- Builder Limit (attempts per loop)
- Research Limit (round trips for web research)
- Repair Limit (attempts to fix verification failures)

### Negotiation Levels

Controls how much the agent challenges your specifications:

| Level | Behavior |
|-------|----------|
| **Agreeable** | Does exactly what you say |
| **Helpful** | Warns about potential issues |
| **Opinionated** | Suggests alternatives |
| **Strict** | Pushes back on bad specs |
| **Cranky** | Full pushback mode (shop teacher persona) |

### Context Management

- **Auto Compression** — Automatically summarize old messages when context fills up
- **Summarizer Model** — Cheap/fast model for compression (example: `openai/gpt-4o-mini`)
- **Compression Threshold** — Percentage of context at which to compress
- **Context Limit** — Override model's default context limit

### Verification Settings

- **Code Verifier Model** — Model used to verify code matches specifications
- **Code Verification Tolerance** — How close values must be (default: 0.1mm)
- **Visual Verification** — Enable vision model verification of rendered images
- **Visual Verifier Model** — Vision-capable model for visual verification
- **Verification Angles** — Camera angles for visual verification (front, back, left, right, top, bottom, iso)

### Preview Settings

- **Mesh Color** — Color of the 3D mesh in the viewport

### Debug Mode

Toggle debug mode to see:
- Per-agent context usage indicators
- Detailed tool call arguments
- Debug log panel with full agent activity

## Agent Tools

The AI agents have access to these tools:

### Code Tools
- `generate_openscad` — Generate new OpenSCAD code
- `edit_openscad` — Edit existing code with find/replace operations
- `replace_lines` — Replace specific line ranges in existing code
- `validate_openscad` — Check code for syntax errors
- `read_code` — Read the current code state

### Specification Tools
- `set_spec` — Track a specification (key, value, unit, critical flag)
- `expand_spec` — Break down a spec into sub-specifications
- `set_verification_hint` — Provide context to the visual verifier
- `ask_clarification` — Pause to ask the user questions

### Knowledge Tools
- `retrieve_skill` — Search the built-in knowledge base
- `retrieve_skill_full` — Get full content of a skill
- `create_skill` — Save a new skill to the knowledge base

### Research Tools
- `web_search` — Search the web for information
- `web_fetch` — Fetch content from a specific URL
- `fetch_next` — Fetch next URL from research queue
- `extract_from_cache` — Search cached research content
- `get_research_status` — Check research queue status
- `submit_research_finding` — Store a research finding
- `get_research_finding` — Retrieve a stored finding
- `list_research_findings` — List all findings

### Asset Tools
- `fetch_raster_image` — Download and store an image
- `fetch_svg_schematic` — Download and store an SVG
- `fetch_pdf_schematic` — Parse a PDF for images and text
- `vectorize_schematic` — Convert raster image to SVG for import

## Knowledge Base

TalkCAD includes a built-in knowledge base (`resources/skills/`) organized into categories:

- **components/** — Common CAD components and patterns
- **design-rules/** — Engineering design guidelines
- **dimensions/** — Standard dimensions for real-world objects
- **materials/** — Material properties and considerations
- **system/** — Agent system instructions
- **techniques/** — OpenSCAD techniques and best practices

The agent automatically queries this knowledge base when relevant. You can also create new skills during conversations that get saved for future use.

## Specifications Tracking

The Specs Panel tracks all specifications extracted from your conversation:

- **Explicit specs** — Requirements you stated directly (always verified)
- **Inferred specs** — Values the agent derived from context (verified)
- **Default specs** — Standard values the agent chose (optional verification)

Each spec shows:
- Key name and value with units
- Verification status (✓ verified, ○ pending)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘1` | Switch to Code view |
| `⌘2` | Switch to Preview view |
| `⌘B` | Toggle File Explorer |
| `⌘J` | Toggle Specs Panel |
| `⌘/` | Focus chat input |
| `Enter` | Send message |
| `Shift+Enter` | New line in message |

## Project Structure

```
talkcad/
├── apps/
│   └── desktop/          # Electron app (React + TypeScript + Vite)
│       ├── src/
│       │   ├── components/   # React UI components
│       │   ├── lib/
│       │   │   ├── agent/    # Agent loop, tools, prompts
│       │   │   └── llm/      # LLM provider abstractions
│       │   ├── store/        # Zustand state management
│       │   └── hooks/        # React hooks
│       └── electron/         # Electron main process
├── packages/
│   └── shared/           # Shared types (@talkcad/shared)
├── resources/
│   └── skills/           # Knowledge base markdown files
```

## Author
Created by [Alexander Mazurovsky](https://alexmaz.com)

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build all packages
pnpm build

# Type check
pnpm typecheck

# Lint
pnpm lint

# Run CLI agent (from apps/desktop)
pnpm cli
```

## License

MIT — See [LICENSE](./LICENSE) for details.
