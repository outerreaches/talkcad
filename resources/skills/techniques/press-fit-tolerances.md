---
tags: [press-fit, interference-fit, tolerance, friction, joint, crush-ribs]
---
# Press-Fit & Friction Tolerances

Creating parts that fit snugly together without fasteners.

## Basics
- **Interference Fit**: The peg is larger than the hole. Plastic deforms to create friction.
- **Clearance Fit**: The peg is smaller than the hole. Slides freely (requires glue or gravity).

## Interference Guidelines (Plastic-on-Plastic)

| Fit Type | Interference Value | Feel |
|----------|-------------------|------|
| **Snug** | 0.0 mm (Exact) | Easy assembly, may wobble slightly |
| **Friction** | +0.05 mm | Distinct resistance, holds weight |
| **Press** | +0.10 mm | Requires force/mallet, permanent |
| **Hard Press** | +0.15 mm+ | Risk of splitting part |

*Note: These values assume specific printing conditions. Printer calibration affects this heavily.*

## The "Crush Rib" Technique (Recommended)
Instead of relying on perfect hole tolerance, add small ribs to the peg. These ribs deform ("crush") easily without stressing the bulk material, making the fit improved across printer variations.

### Design Pattern
1.  Design the main **peg undersized** by 0.1mm (clearance fit).
2.  Add 3-4 small vertical **ribs** that stick out 0.3mm total (0.2mm interference).
3.  The ribs will shave off or flatten during insertion.

```openscad
module pin_with_crush_ribs(h=10, d=5) {
    // 1. Undersized core
    cylinder(h=h, d=d - 0.1); 
    
    // 2. Ribs
    for(i=[0:2]) rotate([0,0,i*120])
        translate([d/2 - 0.2, -0.4, 0])
            cube([0.5, 0.8, h]); // Tiny ribs sticking out
}
```

## Shapes
- **Circle**: Hardest to tolerance perfectly.
- **Hex/Square**: Easier, corners can crush slightly.
- **Taper (Draft)**: Adding a 1-2° taper allows easy entry and progressively tighter fit.

## Tuning for Printers
- **Holes** typically print **undersized** (smaller than CAD) due to arc shrinkage. 
  - *Heuristic*: Design holes +0.1mm to +0.2mm larger than the pin for a "zero" fit.
