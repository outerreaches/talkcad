---
tags: [motor, brushless, drone, quadcopter, 2207, 1404, m3, m2]
---
# Brushless Drone Motors

Standard mounting patterns for multicopter motors.

## Common Stator Classes & Mounts

| Motor Class | Typical Mount Pattern | Screw Size | Application |
|-------------|-----------------------|------------|-------------|
| **110x / 120x** | 9mm circle (4-hole) | M2 | 2.5" - 3" Toothpicks |
| **140x / 150x** | 12mm circle (4-hole) | M2 | 3" - 4" Micro Long Range |
| **220x / 230x** | 16mm × 19mm (4-hole) | M3 | 5" Freestyle / Racing |
| **280x +** | 19mm × 19mm (4-hole) | M3 | 7" Long Range / Cinema |

## Design considerations
1.  **Center Hole**: Always leave a large center hole (>5mm) for the shaft c-clip and bearings. If you touch the clip, the motor binds.
2.  **Protection**: "Soft mounting" with TPU pads is common to reduce vibration.
3.  **Wire Path**: Ensure there is a path for the 3 motor wires to exit towards the ESC.

## OpenSCAD Module

```openscad
// Generates mounting holes for a specific pattern
// d_pattern: Diameter of bolt circle (e.g., 12) or [x, y] for rect (e.g., [16, 19])
module motor_mount_holes(d_pattern=12, screw_d=2.2, center_hole_d=5) {
    // Center Shaft/Clip Clearance
    cylinder(d=center_hole_d, h=10, center=true);
    
    // Bolt Holes
    if (len(d_pattern) == undef) {
        // Circle Pattern (4-hole)
        for(r=[0:90:270]) rotate([0,0,r])
            translate([d_pattern/2, 0, 0]) cylinder(d=screw_d, h=10, center=true);
    } else {
        // Rectangular Pattern (e.g. 16x19)
        for(x=[-1,1]) for(y=[-1,1])
            translate([x*d_pattern[0]/2, y*d_pattern[1]/2, 0])
                cylinder(d=screw_d, h=10, center=true);
    }
}
```
