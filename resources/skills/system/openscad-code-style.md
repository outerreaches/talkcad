---
tags: [system, openscad, code-style, guidelines]
---
# OpenSCAD Code Style Guidelines

## Structure
- Parameters at the top with descriptive names and units in comments
- Use modules for reusable components
- Add comments explaining each section
- Use hull() for smooth transitions; use minkowski() sparingly (expensive)
- Structure: parameters → helper modules → main geometry

## Resolution Settings
- Prefer `$fa` and `$fs` over global `$fn` for consistent detail across scales:
  - `$fa = 2;` (min angle per segment)
  - `$fs = 0.4;` (min segment length in mm)
- Use explicit `$fn` only where needed (threads, specific polygon counts)
- For preview speed: `$fn = 32` is usually sufficient; use higher for final render

## Multi-Part Designs
When a design has multiple separate parts (e.g., lid + base, case + cover):
- Space parts apart so they don't overlap in preview (use translate)
- Typical spacing: 10-20mm gap between parts
- Arrange parts in a row or grid layout
- Example: `translate([0, body_depth + 15, 0]) lid();` places lid 15mm behind the body
- Use different colors for each part:
  - `color("SteelBlue") base();`
  - `color("Coral") lid();`
  - Good contrasting pairs: SteelBlue/Coral, DarkSlateGray/Gold, Teal/Tomato

## Performance Guidelines
- Avoid very high global `$fn` unless needed (threads/knurling can explode polygon count)
- Prefer fewer boolean operations with simpler inputs
- For through-holes/cutouts, use the epsilon overshoot pattern (see `techniques/openscad-booleans-through-holes.md`)
- When designing threaded parts, prefer `threads.scad` modules and keep preview geometry reasonable
- Avoid `minkowski()` with high-polygon inputs; use chamfers or hull-based rounding instead

## Bundled Libraries
TalkCAD bundles **threads.scad** (CC0 license):
- Add `use <threads.scad>;` near the top of the file
- Common modules: `ScrewThread`, `ScrewHole`, `ClearanceHole`, `CountersunkClearanceHole`, `MetricBolt`, `MetricNut`, `MetricWasher`
