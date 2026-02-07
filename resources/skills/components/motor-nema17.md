---
tags: [motor, stepper, nema17, motion, cnc, 3d-printer]
---
# NEMA 17 Stepper Motor

The standard motor for 3D printers and small CNCs.

## Dimensions (Standard "42mm" Body)
- **Face Size**: 42.3 mm × 42.3 mm
- **Mounting Hole Spacing**: 31.0 mm square pattern (centered)
- **Pilot Boss (Center Ring)**:
    - Diameter: 22.0 mm
    - Height: ~2 mm
    - *Crucial*: Your mount must have a cutout for this ring.
- **Shaft**: 5.0 mm diameter (usually with a flat "D-cut")
- **Mounting Screws**: M3 (Thread depth usually 4.5mm max)

## Mounting Pattern Module

```openscad
// Subtract this from your motor plate
module nema17_mount_holes(thickness=5, slot_len=0) {
    // 1. Center Pilot Hole (Clearance for 22mm boss)
    cylinder(d=22.5, h=thickness*3, center=true);
    
    // 2. Mounting Screws (31mm spacing)
    // Optional: slot_len > 0 makes them slots for belt tensioning
    hole_dist = 31.0;
    
    for (x = [-1, 1]) for (y = [-1, 1]) {
        translate([x * hole_dist / 2, y * hole_dist / 2, 0]) {
            if (slot_len > 0) {
                // Slotted holes (hull two circles)
                hull() {
                    translate([-slot_len/2, 0, -thickness]) cylinder(d=3.4, h=thickness*3);
                    translate([slot_len/2, 0, -thickness]) cylinder(d=3.4, h=thickness*3);
                }
            } else {
                // Simple holes
                translate([0,0,-thickness]) cylinder(d=3.4, h=thickness*3);
            }
        }
    }
}

// Dummy Visual
module nema17_mockup() {
    color("DarkGray") difference() {
        cube([42.3, 42.3, 34], center=true);
        // Cut corners (NEMAs are octagonal-ish)
        for(r=[0:90:270]) rotate([0,0,r])
            translate([20, 20, -20]) rotate([0,0,45]) cube([10,10,50]);
    }
    // Pilot
    color("Silver") translate([0,0,17]) cylinder(d=22, h=2);
    // Shaft
    color("Silver") translate([0,0,17]) cylinder(d=5, h=24);
}
```

## Thermal Note
Stepper motors get hot (often 50-80°C).
- **PLA mounts** may soften and warp ("creep") under bolt tension if the motor runs hot.
- **PETG/ABS** is recommended for motor mounts.
- If using PLA, add washers to spread load or isolate heat.
