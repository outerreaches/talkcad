---
tags: [technique, multi-part, assembly, printing, layout, separation]
---
# Multi-Part Design & Printing Layout

How to design assemblies (e.g., Box + Lid) in a single file while keeping them printable.

## Core Principles

1.  **Model in Place**: Design parts where they belong functionally (e.g., Lid on top of Box). This ensures fit.
2.  **Print Side-by-Side**: Move parts to the print bed (Z=0) for final output/preview.
3.  **Visualization**: Use a variable to toggle between "Assembly View" (closed) and "Print View" (flat).

## The "Explode/Print" Pattern

Use a top-level boolean or variable to control part positions.

```openscad
// 0 = Assembly View (Lid on Box)
// 1 = Print View (Side by Side)
exploded = 1; 

part_gap = 20; // Distance between parts on print bed

// --- Main Assembly ---

// 1. The Box (Always at 0,0,0)
color("SteelBlue") box();

// 2. The Lid
// Logic: If exploded, move to side and rotate to flat. If not, sit on top.
translate(exploded ? [box_width + part_gap, 0, 0] : [0, 0, box_height])
    rotate(exploded ? [180, 0, 0] : [0,0,0]) // Flip lid upside down for printing
    color("Coral") lid();

// --- Modules ---

module box() {
    difference() {
        cube([50, 40, 30]);
        translate([2, 5.5, 2]) cube([46, 33, 30]);
    }
}

module lid() {
    cube([50, 40, 2]);
    // Lip that fits inside box
    translate([2.5, 6, 2]) cube([45, 32, 2]);
}
```

## Naming & Colors
- **Box**: Use distinct colors for contrast (e.g., `SteelBlue` and `Coral`).
- **Organization**: Keep modules separate. Never put `translate()` *inside* the module definition unless it defines the part's local origin.
- **Orientation**: Always orient parts for **minimal supports**.
    - Lids: Usually printed top-face down.
    - Boxes: Usually printed bottom-face down.

## Common Mistake: Shared Walls
Do NOT rely on unioning parts together. If you need two parts to fuse (make one big print), use `union()`. If they are separate physical objects, keep them separate in code.
