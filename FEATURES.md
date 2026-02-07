# TalkCAD Features

Comprehensive list of all features, settings, modes, and configurations.

---

## Autonomy Modes

Control how independently the AI agents work.

| Mode | Description |
|------|-------------|
| **Guided** | User-driven. No research or auto-verification. Agent responds to user prompts without autonomous actions. |
| **Researched** | Agent can search the web for specs and datasheets. No auto-verification. |
| **Verified** | Full loop: Research → Build → Verify → Repair. Agent autonomously validates its work. |
| **Ralph** | Infinite self-healing loop. Clears context and resumes from existing state when stuck. |

---

## Example Workflows

### Example 1: Guided Mode — Quick Prototyping

**Settings:**
- Autonomy: Guided
- Web Tools: Off
- Visual Verification: Off

**Use case:** You know exactly what you want and just need the agent to translate your description to OpenSCAD.

**Workflow:**
```
You: "Make a box 50x30x20mm with 2mm walls and a lid that snaps on"

Agent: [Searches skills for "snap-fit"]
       [Generates OpenSCAD code]
       [Returns code for review]

You: "The snap tabs are too thick, make them 1mm"

Agent: [Edits code]
       [Returns updated code]
```

---

### Example 2: Researched Mode — Unknown Component

**Settings:**
- Autonomy: Researched
- Web Tools: On
- Research Limit: 3
- Visual Verification: Off

**Use case:** You need to design around a component you don't have specs for.

**Workflow:**
```
You: "Make a mount for an ESP32-WROOM-32 module"

Agent: [Checks skills — no match]
       [Requests research from Researcher agent]

Researcher: [web_search: "ESP32-WROOM-32 dimensions datasheet"]
            [fetch_next: espressif.com datasheet PDF]
            [submit_research_finding: board dimensions 25.5x18mm]
            [Returns to Builder]

Builder: [get_research_finding: "esp32_dimensions"]
         [Generates mount with correct dimensions]
         [create_skill: saves ESP32 dimensions for future use]
```

---

### Example 3: Verified Mode — Precision Part

**Settings:**
- Autonomy: Verified
- Web Tools: On
- Visual Verification: On
- Verification Angles: Front, Right, Top, Iso
- Tolerance: 0.1mm
- Repair Limit: 3

**Use case:** The part must meet exact specifications (e.g., a threaded adapter).

**Workflow:**
```
You: "Make a 1/2-28 to 5/8-24 thread adapter, 25mm long"

Builder: [retrieve_skill: "threads", "imperial threads"]
         [Generates OpenSCAD with ScrewThread calls]
         [set_spec: internal_thread.tpi = 28, critical=true]
         [set_spec: external_thread.tpi = 24, critical=true]
         [set_spec: length = 25mm, critical=true]

Orchestrator: [Runs code verification]
              [Code verifier checks: specs match code values ✓]

Orchestrator: [Runs visual verification]
              [Renders from 4 angles]
              [Visual verifier: "Thread profile visible ✓"]
              [Visual verifier: "Length appears correct ✓"]

Result: Build passes, STL ready
```

**If verification fails:**
```
Visual Verifier: "WARNING: External thread appears to start 
                  inside the body, not flush with end"

Orchestrator: [Returns to Builder with failure report]

Builder: [read_code to see current state]
         [replace_lines to fix thread positioning]
         [set_verification_hint: "External thread should 
          start 2mm from the end for the hex grip section"]

Orchestrator: [Re-verifies — passes]
```

---

### Example 4: Ralph Mode — Complex Assembly

**Settings:**
- Autonomy: Ralph
- Max Iterations: 5
- Builder Limit: 15
- Web Tools: On
- Visual Verification: On

**Use case:** Large, complex design where the agent may get confused or context may fill up.

**Workflow:**
```
You: "Design a complete FPV drone frame for 5-inch props 
      with mounting for FC stack, 4 motors, battery strap, 
      and camera mount"

Iteration 1:
  Builder: [Researches motor patterns, FC stack dims]
           [Generates base frame with arms]
           [Context fills to 85% — auto-compressed]
           [Verification fails: motor mounts wrong spacing]

Iteration 2:
  [Context cleared, but code preserved]
  Builder: [read_code — sees existing frame]
           [Fixes motor mount spacing]
           [Adds FC stack mount]
           [Verification fails: camera mount missing]

Iteration 3:
  Builder: [Adds camera mount]
           [All verifications pass]

Result: Complete drone frame after 3 iterations
```

---

### Example 5: Offline Mode — Air-Gapped Environment

**Settings:**
- LLM Provider: Ollama
- Base URL: http://localhost:11434
- Model: llama3.2
- Web Tools: Off
- Visual Verification: On (uses same local model)

**Use case:** No internet access, using only local models and built-in skills.

**Workflow:**
```
You: "Make a NEMA 17 motor mount with 4 M3 holes"

Agent: [retrieve_skill: "NEMA 17" — found in built-in skills]
       [Uses skill dimensions: 42.3mm, 31mm hole spacing, etc.]
       [Generates mount without any web access]
       [Visual verification runs locally]
```

---

### Example 6: Maximum Autonomy — Hands-Off Build

**Settings:**
- Autonomy: Verified
- Personality: Opinionated
- Builder Limit: 20
- Research Limit: 5
- Repair Limit: 10
- Auto-Compression: On
- Visual Verification: On (all 7 angles)

**Use case:** You describe the end goal and let the agent handle everything.

**Workflow:**
```
You: "I need a waterproof enclosure for a Raspberry Pi 4 
      with a camera, power connector, and ventilation"

Agent autonomously:
1. Researches RPi4 dimensions
2. Researches camera module dimensions
3. Checks skills for ventilation patterns and O-ring grooves
4. Designs enclosure with proper clearances
5. Adds O-ring groove for seal
6. Adds vent with water-resistant pattern
7. Verifies from all angles
8. Repairs any issues found
9. Saves new skills for RPi camera mount
10. Returns final STL
```

---

### Example 7: Strict Personality — Teaching Mode

**Settings:**
- Autonomy: Guided
- Personality: Strict
- Web Tools: On

**Use case:** Learning CAD design with an agent that pushes back on mistakes.

**Workflow:**
```
You: "Make a bracket with 0.5mm walls"

Agent: "0.5mm walls are too thin for FDM printing and will 
        likely fail. Recommended minimum is 1.2mm (3 perimeters).
        Do you want me to use 1.2mm instead?"

You: "Fine, use 1.5mm"

Agent: [Proceeds with 1.5mm walls]
```

---

## Agent Personality (Negotiation Levels)

Affects how the Builder agent responds to user specifications.

| Level | Behavior |
|-------|----------|
| **Agreeable** | Accepts all user specifications without questioning |
| **Helpful** | Implements requests while gently noting potential issues |
| **Opinionated** | Actively suggests better alternatives for suboptimal specs |
| **Strict** | Pushes back on problematic specifications, requires justification |
| **Cranky** | Full pushback mode—like a gruff shop teacher who has seen every mistake |

---

## LLM Providers

TalkCAD supports multiple AI providers.

### Cloud Providers
| Provider | API Key Required | Notes |
|----------|-----------------|-------|
| **OpenRouter** | Yes | Meta-router for any model (Claude, GPT, Gemini, Llama, etc.) |
| **OpenAI** | Yes | Direct access to GPT-4, GPT-4o |
| **Google Gemini** | Yes | Gemini 2.5, Flash |
| **Groq** | Yes | Fast inference for Llama models |

### Local Providers
| Provider | Base URL Required | Notes |
|----------|-------------------|-------|
| **Ollama** | Yes (default: localhost:11434) | Run any GGUF model locally |
| **LM Studio** | Yes (default: localhost:1234) | GUI app for local models |
| **llama.cpp** | Yes (default: localhost:8080) | Direct llama.cpp server |
| **Custom** | Yes + API Key | Any OpenAI-compatible endpoint |

---

## Budget Controls

Configure iteration and retry limits.

| Setting | Default | Description |
|---------|---------|-------------|
| **Max Iterations (Ralph)** | 3 | Number of fresh restarts in Ralph mode |
| **Builder Limit** | 10 | Max attempts to write/fix code per loop |
| **Research Limit** | 3 | Max web search round-trips |
| **Repair Limit** | 10 | Max fix attempts after verification failure |

---

## Context Management

Handle long conversations without running out of context.

| Setting | Default | Description |
|---------|---------|-------------|
| **Auto-Compression** | On | Automatically summarize old messages when context fills |
| **Summarizer Model** | Same as main | Model for compressing context (can use cheaper model) |
| **Compression Threshold** | 80% | Trigger compression when context reaches this % |
| **Context Visibility** | 70% | Show indicator in UI when context reaches this % |
| **Context Limit Override** | 0 (auto) | Override model's default context limit (tokens) |

---

## Verification System

Dual verification ensures generated models match specifications.

### Code Verification
- Analyzes OpenSCAD code against recorded specs
- Checks dimensions, tolerances, feature presence
- Tolerance: configurable (default 0.1mm)

### Visual Verification
- Renders model from multiple camera angles
- Uses vision model to inspect rendered images
- Compares visual output to expected features

| Setting | Default | Description |
|---------|---------|-------------|
| **Visual Verification** | On | Enable/disable visual verification step |
| **Code Verifier Model** | Main model | Model for code analysis |
| **Visual Verifier Model** | Main model | Vision model for image inspection |
| **Verification Tolerance** | 0.1mm | How close values must match to pass |

### Verification Angles
Choose which camera angles to render:
- Front, Back, Left, Right
- Top, Bottom
- Isometric

Default: Front, Right, Top, Isometric

---

## Web Access Tools

Control network/internet access.

| Setting | Default | Description |
|---------|---------|-------------|
| **Web Tools Enabled** | On | Allow `web_search`, `web_fetch`, and remote `fetch_*` tools |

> **Note**: Web search currently requires an OpenRouter API key (uses `:online` suffix models).

---

## OpenSCAD Integration

| Feature | Description |
|---------|-------------|
| **Auto-detection** | Automatically finds OpenSCAD on your system |
| **Custom Path** | Manually specify OpenSCAD executable location |
| **Real-time Validation** | Validates code syntax as you type |
| **Geometry Validation** | Full geometry compilation check |
| **Multi-angle Rendering** | Renders from configurable camera angles |
| **STL Export** | Export to STL for 3D printing |

### Bundled Libraries
- **threads.scad** — Thread generation (metric, imperial)

---

## 3D Preview

Interactive Three.js-powered viewport.

| Setting | Options | Default |
|---------|---------|---------|
| **Display Mode** | Solid, Wireframe | Solid |
| **Mesh Color** | Any hex color | #60a5fa (blue) |
| **Show Axis Gizmo** | On/Off | On |
| **Camera Mode** | Perspective, Orthographic | Perspective |

### Viewport Controls
- **Orbit**: Click and drag
- **Pan**: Right-click and drag, or Shift + drag
- **Zoom**: Scroll wheel

---

## Agent Tools

### Code Tools
| Tool | Description |
|------|-------------|
| `generate_openscad` | Generate complete OpenSCAD code |
| `edit_openscad` | Edit existing code with find/replace |
| `replace_lines` | Replace specific line ranges |
| `validate_openscad` | Check code for syntax and geometry errors |
| `read_code` | Read current code with line numbers |

### Specification Tools
| Tool | Description |
|------|-------------|
| `set_spec` | Record a design specification |
| `expand_spec` | Break down a spec into sub-specifications |
| `set_verification_hint` | Provide context to visual verifier |
| `ask_clarification` | Pause to ask user questions |

### Knowledge Tools
| Tool | Description |
|------|-------------|
| `retrieve_skill` | Search built-in knowledge base |
| `retrieve_skill_full` | Get full content of a skill |
| `create_skill` | Save new skill to knowledge base |

### Research Tools
| Tool | Description |
|------|-------------|
| `web_search` | Search the web |
| `web_fetch` | Fetch content from a URL |
| `fetch_next` | Fetch next URL from research queue |
| `extract_from_cache` | Search cached research content |
| `get_research_status` | Check research queue status |
| `submit_research_finding` | Store a research finding |
| `get_research_finding` | Retrieve a stored finding |
| `list_research_findings` | List all findings |

### Asset Tools
| Tool | Description |
|------|-------------|
| `fetch_raster_image` | Download and store an image |
| `fetch_svg_schematic` | Download and store an SVG |
| `fetch_pdf_schematic` | Parse PDF for images and text |
| `vectorize_schematic` | Convert raster to SVG for import |

---

## Knowledge Base (Skills)

Built-in library of CAD knowledge that grows as you use TalkCAD.

### How Skills Work

Skills are markdown files containing verified CAD knowledge: dimensions, techniques, design patterns, and component specifications. The agent searches skills before making web requests, ensuring fast and reliable access to commonly-needed information.

```
resources/skills/
├── components/     # Physical component dimensions
├── techniques/     # CAD patterns and methods
├── design-rules/   # Best practices and constraints
├── dimensions/     # Standard sizes and conversions
├── materials/      # Material properties
├── system/         # Agent behavior prompts
└── learned/        # User-generated skills (gitignored)
```

### Built-in Categories

| Category | Count | Examples |
|----------|-------|----------|
| **components/** | ~40 | Arduino, Raspberry Pi, NEMA 17, bearings, USB connectors, GoPro mounts, rails |
| **techniques/** | ~16 | Living hinge, dovetail joints, snap-fit, threads.scad usage, knurling |
| **design-rules/** | ~4 | FDM printing minimums, ISO clearance holes, 3D text rules |
| **dimensions/** | ~3 | Metric threads, hex across-flats, unit conversions |
| **materials/** | ~2 | PLA, PETG properties for tolerance calculations |
| **system/** | ~4 | Internal prompts (coordinate system, boolean ops, code style) |

### Skill Format

Each skill is a markdown file with YAML frontmatter:

```markdown
---
tags: [motor, stepper, nema17, mounting, motion]
---
# NEMA 17 Stepper Motor

## Dimensions
- Face: 42.3 × 42.3 mm
- Mounting holes: 31mm spacing (M3)
- Shaft: 5mm diameter
- Shaft length: 24mm (typical)

## Usage
\`\`\`openscad
module nema17_mount() {
  difference() {
    cube([42.3, 42.3, 5], center=true);
    // Mounting holes at 31mm spacing
    for (x = [-15.5, 15.5], y = [-15.5, 15.5])
      translate([x, y, 0]) cylinder(h=10, d=3.2, center=true);
  }
}
\`\`\`
```

### Skills with Schematics

Some skills include attached SVG or DXF files for complex profiles:

| Skill | Schematic | Use Case |
|-------|-----------|----------|
| `rail-arca-swiss.md` | `rail-arca-swiss.svg` | Dovetail profile for camera mounting |
| `picatinny-rail.md` | `picatinny-rail.svg` | MIL-STD-1913 rail cross-section |
| `extrusion-2020.md` | `extrusion-2020.dxf` | Aluminum extrusion profile |

When retrieving a skill with a schematic, the agent automatically:
1. Copies the schematic to session assets
2. Returns the absolute path for `import()` in OpenSCAD
3. Uses `linear_extrude()` to create 3D geometry from the profile

---

## Skill Learning System

The agent can create new skills from research findings, building a personalized knowledge base over time.

### When Skills Are Created

Skills are created when the agent:
1. **Researches a new component** — Dimensions found via web search are saved
2. **Discovers a useful technique** — Patterns that worked well are documented
3. **Receives user corrections** — Verified dimensions from user feedback

### Learning Workflow

```
1. User requests: "Make a mount for DJI O3 Air Unit"

2. Agent checks skills → No match found

3. Researcher searches web:
   - Finds official DJI specs page
   - Extracts: 30.5×30.5mm mounting, M2 holes, 25.5×25.5 spacing
   - Submits to temporary knowledge base

4. Builder uses findings to create mount

5. After successful verification, Builder creates skill:
   create_skill({
     title: "DJI O3 Air Unit Dimensions",
     tags: ["dji", "o3", "fpv", "air-unit", "mounting"],
     content: "# DJI O3 Air Unit\n\n## Mounting\n- Pattern: 30.5×30.5mm..."
   })

6. Skill saved to: resources/skills/learned/dji-o3-air-unit-dimensions.md

7. Future requests for "O3 Air Unit" find skill instantly
```

### Learned Skills Directory

User-generated skills are saved to `resources/skills/learned/`:

```
resources/skills/learned/
├── dji-o3-air-unit-dimensions.md
├── esp32-wroom-32-module.md
├── gopro-hero-12-dimensions.md
└── custom-thread-adapter-pattern.md
```

This directory is:
- **Gitignored** — Not included in public repo
- **Session-persistent** — Survives app restarts
- **Searchable** — Same priority as built-in skills

### Skill Update vs Create

The `create_skill` tool supports updating existing skills:

```javascript
// Create new skill
create_skill({ title: "Component X", tags: [...], content: "..." })

// Update existing skill (overwrites)
create_skill({ title: "Component X", tags: [...], content: "...", update: true })
```

### Skill Search

The agent searches skills using fuzzy matching on:
- **Title** — Skill name
- **Tags** — Searchable keywords
- **Content** — Full-text search

Example search flow:
```
retrieve_skill("nema 17 motor")
→ Matches: components/motor-nema17.md (tags: nema17, motor, stepper)

retrieve_skill("snap fit")  
→ Matches: components/snap-fit.md (title: "Snap-Fit Joints")

retrieve_skill("thread adapter")
→ Matches: techniques/openscad-threads-scad.md (content mentions adapters)
```

### Knowledge Hierarchy

The agent follows this priority when gathering information:

```
1. Built-in Skills     → Fastest, most reliable
2. Learned Skills      → User-verified, session-specific
3. Temporary KB        → Current session research (not persisted)
4. Web Research        → Slowest, requires network
5. User Clarification  → Last resort
```

This hierarchy ensures the agent prefers verified local knowledge over expensive web searches.

---

## Session Management

| Feature | Description |
|---------|-------------|
| **Auto-save** | Code, specs, and chat persist across sessions |
| **Session List** | Switch between saved projects |
| **Rename/Delete** | Manage saved sessions |
| **Asset Storage** | Images and schematics stored per-session |
| **STL Caching** | Rendered STL saved for quick reload |

---

## Debug Mode

Developer features for troubleshooting.

| Feature | Description |
|---------|-------------|
| **Debug Panel** | Real-time log of agent actions |
| **Tool Call Logging** | See every tool invocation and result |
| **Context Tracking** | Per-agent token usage display |
| **Agent Activity** | Live status (thinking, tool call, waiting) |

---

## UI Layout

| Feature | Description |
|---------|-------------|
| **View Modes** | Code only, Preview only, Split view |
| **Collapsible Panels** | Files panel, Specs panel |
| **Resizable Chat** | Drag to resize chat height |
| **Dark Theme** | Zinc-based dark UI |

---

## Export

| Format | Description |
|--------|-------------|
| **STL** | Standard mesh format for 3D printing |

---

## CLI Support

| Feature | Description |
|---------|-------------|
| **Debug Harness** | `npx tsx scripts/cli-agent.ts "prompt"` |
| **Shared Config** | CLI reads same config as GUI |
| **Mock Dependencies** | Runs without full Electron environment |
