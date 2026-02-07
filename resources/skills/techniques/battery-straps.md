---
tags: [battery, strap, velcro, mount, slot, lipo]
---
# Battery Strap Slots

How to secure batteries (LiPos) effectively.

## Strap Dimensions
- **Standard Width**: 20mm (fits powerful 5" drones).
- **Mini Width**: 15mm.
- **Thickness**: ~1.5mm - 2mm (Kevlar/Leather straps are thick).

## Design Pattern: The "Bridge"
Do not just cut a hole in a flat plate; the strap needs to pass *under* or *through* the frame.

### Dimensions for Slot
- **Length**: 22mm - 24mm (for 20mm strap). Give is wobble room.
- **Width (Height)**: 3mm - 4mm. Easy to thread.
- **Chamfer**: **CRITICAL**. Sharp edges will slice the strap during a crash. Always round the opening.

### OpenSCAD Module

```openscad
// Subtract this from your frame plate
module strap_slot(len=23, height=3.5, depth=10) {
    hull() {
        // Left circle
        translate([-len/2 + height/2, 0, 0])
             cylinder(d=height, h=depth, center=true);
        // Right circle
        translate([len/2 - height/2, 0, 0])
             cylinder(d=height, h=depth, center=true);
    }
}
```

## Grip Tape
Always leave a flat area (min 30mm x 50mm) for a stick-on silicone/rubber battery pad. The strap holds tension; the pad prevents sliding. Plastic-on-plastic slides instantly.
