---
tags: [bearing, 608, skateboard, roller-blade]
---
# 608 Ball Bearing ("Skate Bearing")

The ubiquitous, cheap ball bearing used in fidget spinners, spool holders, and DIY machines.

## Dimensions
- **Outer Diameter (OD)**: 22.0 mm
- **Inner Diameter (ID)**: 8.0 mm
- **Width / Thickness**: 7.0 mm

## Mounting Guidelines

### 1. Vertical Shaft (standing up)
Printing a vertical peg for a bearing:
- **Avoid Friction**: The inner race must spin; the outer race must be fixed (or vice versa).
- **Spacer**: Use a small "speed washer" or printed rim so the moving race doesn't rub.

### 2. Press Fits (Plastic Holding Outer Ring)
- **Tight Fit**: 21.9 mm - 22.0 mm (Might crack the plastic; required for high load)
- **Push Fit (Regular)**: 22.1 mm - 22.2 mm (Slides in, holds by friction)
- **Loose Fit (Glued)**: 22.4 mm+

### 3. OpenSCAD Module
Includes a spacer rim to prevent rubbing.

```openscad
module bearing_608_dummy() {
    color("Silver") 
        difference() {
            cylinder(d=22, h=7);
            translate([0,0,-1]) cylinder(d=8, h=9);
        }
}

// A generic "bearing post" for ID=8mm
module bearing_post_standing(h=10) {
    // The shaft (undersized ID for clearance)
    cylinder(d=7.8, h=h);
    
    // The base rim (Only touches INNER race)
    // ID=8mm, Inner Race Wall ~1mm -> Rim D < 10mm
    cylinder(d=9.5, h=1); 
}

// A generic "bearing pocket" for OD=22mm
module bearing_pocket_recess(h=7) {
    // Main hole (Oversized for push fit)
    cylinder(d=22.2, h=h+0.1);
    
    // Thru-hole for the inner race/shaft to pass
    // Must be > ID but < OD. Inner race is ~11mm usually? 
    // Safest is clear the whole center >15mm if strictly holding outer.
    translate([0,0,-1]) cylinder(d=16, h=h+2); 
    
    // Rim ledge to stop it falling through (touches OUTER race)
    // OD=22, Outer Race Wall ~2mm -> Ledge D > 19mm
    difference() {
         cylinder(d=22.2, h=1); // The bottom of the pocket
         cylinder(d=19, h=3, center=true); // The hole in the ledge
    }
}
```
