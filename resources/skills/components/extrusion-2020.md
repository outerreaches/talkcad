---
tags: [extrusion, 2020, aluminum, profile, t-nut, frame]
---
# 2020 Aluminum Extrusion (V-Slot / T-Slot)

**Schematic**: [extrusion-2020.dxf](./extrusion-2020.dxf) (DXF cross-section)

The standard framing material for 3D printers and DIY CNCs.

## Dimensions
- **Profile Size**: 20mm × 20mm square.
- **Slot Width**: 6mm (Standard).
- **Core Hole**: Usually 5mm hole (can be tapped to M5 or M6 depending on brand, check fits).

## Mounting to it
You mount things to extrusion using **T-Nuts** that slide into the slot.

1.  **Drop-in T-Nuts**: Insert anywhere, rotate 90° to lock. M3, M4, M5 common.
2.  **Slide-in T-Nuts**: Must be inserted from ends. Stronger.
3.  **Printed brackets**: Need a "key" or "nub" to align in the slot.

### Alignment Key (The "Nub")
To keep a printed part straight on 2020 rail, print a rectangular nub on the face.
- **Width**: 5.8mm (fits in 6mm slot with clearance).
- **Depth**: 1.5mm - 2mm.

## OpenSCAD Module (Mockup & Mount)

```openscad
// A mockup of the rail to visualize checks
module extrusion_2020_mockup(len=100) {
    color("Silver")
    linear_extrude(len)
        difference() {
            square([20, 20], center=true);
            // Slots (Approximate)
            square([6, 22], center=true);
            square([22, 6], center=true);
            circle(d=5); // Center hole
        }
}

// A bracket base with alignment nubs
module mount_base_2020() {
    // Plate
    cube([30, 30, 4], center=true);
    
    // Nubs (Alignment)
    translate([0, 0, -2.5]) // Stick out bottom
        cube([5.8, 30, 1.5], center=true); // Runs along slot
        
    // Screw Holes (for T-nuts)
    translate([0, 10, 0]) cylinder(d=5.5, h=10, center=true); // M5
    translate([0, -10, 0]) cylinder(d=5.5, h=10, center=true); // M5
}
```
