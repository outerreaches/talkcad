---
tags: [gopro, action-camera]
---
# GoPro Mount (The "Finger" Joint)

The universal action camera hinge.

## Standard Dimensions
- **Hole Diameter**: 5.0 mm (M5 bolt).
- **Finger Width**: 3.0 mm (approx).
- **Slot Width**: 3.1 mm - 3.2 mm (Clearance).
- **Outer Diameter**: 15 mm (Rounded ends).

## Configuration
1.  **The Camera (2-Prong)**: The device usually has 2 fingers.
2.  **The Mount (3-Prong)**: The base usually has 3 fingers (leaves 2 slots).

*Note: Some newer mounts reverse this, but 3-Prong is the standard "buckle" side.*

## Printable Design Rules
1.  **Orientation**: Fingers must be printed **flat** on the bed. If you print them sticking up (Z-axis), the layer lines will snap when you tighten the bolt.
2.  **Supports**: Use "Tree Supports" or custom supports under the rounded overhangs.

## OpenSCAD Module (3-Prong Mount)

```openscad
module gopro_mount_3prong() {
    finger_w = 3.0;
    gap = 3.1;
    outer_d = 15;
    
    // 3 Fingers
    for (i=[-1, 0, 1]) {
        translate([0, i * (finger_w + gap), 0])
            difference() {
                // Finger Shape
                hull() {
                    rotate([0,90,0]) cylinder(d=outer_d, h=finger_w, center=true);
                    translate([10, 0, 0]) cube([10, finger_w, outer_d], center=true); // Base connection
                }
                // Bolt Hole
                rotate([0,90,0]) cylinder(d=5.2, h=10, center=true);
                // Nut Trap (Hex) - Optional on one side
            }
    }
}
```
