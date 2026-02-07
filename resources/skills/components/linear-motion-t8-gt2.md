---
tags: [linear-motion, t8, lead-screw, gt2, belt, pulley, cnc, printer]
---
# Linear Motion Components

Standard parts for moving things.

## T8 Lead Screws (Z-Axis)
Used for high force/precision, low speed.
- **Diameter**: 8mm
- **Pitch**: Usually 2mm.
- **Lead**: Usually 8mm (4 starts). *This is confusing. "T8x8" moves 8mm per turn.*
- **Nut**: Brass nut is standard.
    - Flange diameter: 22mm.
    - Mounting holes: 4x M3 on 16mm circle.

## GT2 Components (X/Y Axis)
Used for high speed, lower force.
- **Belt Width**: 6mm standard.
- **Pitch**: 2mm. (20 tooth pulley = 40mm per turn).

### Belt Clamp Patterns
To grab a belt with a printed part:
1.  **Zip Tie Method**: Fold belt back on itself, zip tie loop.
2.  **Tooth Profile**: Print matching inverse teeth (hard to resolve on FDM).
3.  **Wavy Path**: Force belt through a serpentine path. Friction holds it.

```openscad
// A simple wavy belt slot
module belt_clamp_slot_gt2(width=7) {
    // Main channel
    cube([20, width, 1.5]); // Belt thickness ~1.38mm
    // Dent 1
    translate([5, 0, 0.5]) cube([2, width, 2]);
    // Dent 2
    translate([15, 0, 0.5]) cube([2, width, 2]);
}
```

## LM8UU Bearings
Linear ball bearings for 8mm smooth rods.
- **OD**: 15 mm
- **Length**: 24 mm
- **Mounting**: Press fit (tight!) or use zip-ties/retaining rings. Do not crush with heavy screw force or balls will bind.
