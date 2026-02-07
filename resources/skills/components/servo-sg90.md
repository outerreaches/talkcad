---
tags: [servo, sg90, motor, rc]
---
# SG90 Micro Servo

The standard "9g" servo for robotics.

## Dimensions
- **Body Size**: 23.0 mm (L) × 12.2 mm (W) × 22.7 mm (H)
- **Flange Size**: 32.2 mm (L) × 12.2 mm (W)
- **Mounting Hole Pitch**: 28.0 mm (center-to-center)
- **Spline/Shaft**: Offset ~6mm from the end.

## Mounting Pattern

```openscad
// Use minimal clearance (0.2mm) for press-fit
module sg90_cutout(clearance=0.2) {
    // Body Cutout
    cube([23.5, 12.5, 30], center=true);
    
    // Screw Holes (28mm pitch)
    translate([14, 0, 0]) cylinder(d=2, h=30, center=true);
    translate([-14, 0, 0]) cylinder(d=2, h=30, center=true);
}

// Dummy Visual
module sg90_mockup() {
    color("Blue") {
        translate([-11.5, -6.1, 0]) cube([23, 12.2, 22.7]);
        // Flanges
        translate([-16.1, -6.1, 16]) cube([32.2, 12.2, 2.5]);
    }
    color("White") {
        translate([-11.5 + 5.5, 0, 22.7]) cylinder(d=12, h=4); // Gear bumps
        translate([-11.5 + 5.5, 0, 26]) cylinder(d=4.5, h=3); // The spline
    }
}
```
