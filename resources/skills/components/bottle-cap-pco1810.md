---
tags: [bottle, cap, pco-1810, soda, thread, recycling]
---
# PCO 1810 Bottle Cap (Soda Bottle)

The standard thread found on almost all carbonated soda bottles (Coke, Pepsi) worldwide.

## Dimensions
- **Major Diameter**: ~27.4 mm
- **Pitch**: 3.18 mm (approx 8 TPI)
- **Neck ID**: ~21.7 mm

## OpenSCAD Implementation
Using the built-in `threads.scad` library is the easiest way to interface with these.

```openscad
use <threads.scad>;

// 1. Cap (Female Thread)
module pco1810_cap() {
    // 28mm is nominal, add tolerance for printing
    // Pitch is strictly 3.18
    ScrewHole(outer_diam=28.4, height=12, pitch=3.18, tooth_angle=30, tolerance=0.4) {
         cylinder(d=32, h=14); // The cap body
    }
}

// 2. Connector (Male Thread)
// To screw INTO a bottle (rare) or duplicate a bottle neck
module pco1810_neck() {
    ScrewThread(outer_diam=27.4, height=20, pitch=3.18, tooth_angle=30, tolerance=0.4);
}
```

## Sealing
Plastic-on-plastic threads **do not seal liquids**.
- **O-Ring**: You must design a groove for a rubber O-ring at the base or top face of the neck to hold pressure.
- **Gasket**: Cut a 28mm rubber circle from an inner tube for the cap.
