---
tags: [drone, fpv, flight-controller, 30x30, 20x20, whoop, aio]
---
# Flight Controller Stacks

Standard mounting patterns for FPV drone electronics (Flight Controllers, ESCs).

## 1. Standard "30x30" Stack
Used in 5-inch+ quadcopters.
- **Hole Spacing**: 30.5mm × 30.5mm
- **Hole Diameter**: 3mm (M3) (Often requires 4mm space for rubber grommets)
- **Outer PCB Size**: Typically 36mm to 40mm square.
- **Corner Radius**: Keep clear of standoffs.

## 2. Mini "20x20" Stack
Used in 3-inch to 5-inch lightweight builds.
- **Hole Spacing**: 20mm × 20mm
- **Hole Diameter**:
    - **M2**: (Older standard) 2mm holes.
    - **M3**: (Modern standard) 3mm holes (or M2 with grommets).
- **Outer PCB Size**: ~27mm square.

## 3. Whoop / AIO "25.5x25.5" Pattern
Used in Tiny Whoops and Toothpicks.
- **Orientation**: Rotated 45° (Diamond pattern)
- **Hole Spacing**: 25.5mm × 25.5mm
- **Hole Diameter**: M2 (usually uses rubber dampers).

## OpenSCAD Module

```openscad
module fc_mount_pattern(size=30.5, screw_d=3) {
    // 4 Corner holes centered on origin
    for(x=[-1,1]) for(y=[-1,1])
        translate([x*size/2, y*size/2, 0])
             cylinder(d=screw_d, h=10, center=true);
}

// Usage:
// 30x30: fc_mount_pattern(30.5, 3);
// 20x20: fc_mount_pattern(20, 2); // Check if M2 or M3
```
