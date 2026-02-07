---
tags: [hinge, pip, print-in-place, articulation, joint, tolerance]
---
# Print-in-Place (PIP) Hinges

Creating joints that are printed fully assembled and move immediately off the build plate.

## The Core Concept: Vertical Clearance
You cannot print a rod inside a hole horizontally without them fusing (sag).
**PIP Hinges are printed Vertically (Cone-in-Cone) or with 45° clearance gaps.**

## Type 1: The Cone Hinge (Vertical)
Best for doors/boxes printed flat.
- A cone sits inside another cone. The 45° angle is self-supporting.
- **Clearance**: 0.3mm - 0.4mm air gap between the cones.

## Type 2: The Pin Hinge (Horizontal)
Requires careful bridging.
- **Pin**: Indented polygon (e.g., Octagon).
- **Hole**: Teardrop shape or chamfered roof.
- **Clearance**: 0.4mm - 0.5mm (Needs more than vertical).

## Design Rules
1.  **Air Gap**: Minimum 0.3mm everywhere between moving parts.
2.  **Fused Layers**: The bottom few layers often elephant-foot together. Add a **chamfer** to the bottom of the hinge pin to lift the gap off the bed.
3.  **Break-in**: PIP parts usually require a "crack" (forceful first movement) to snap the stray micro-stringing.

## OpenSCAD Module (Safe Vertical Hinge)

```openscad
module pip_hinge_vertical(h=10, r=4) {
    gap = 0.4;
    
    // Outer Knuckle (Female)
    difference() {
        cylinder(r=r+2, h=h);
        translate([0,0,-1]) cylinder(r=r, h=h+2); // Hole
    }
    
    // Inner Pin (Male)
    color("Silver") {
        translate([0,0,0]) cylinder(r=r-gap, h=h);
        // Retaining caps (so pin doesn't fall out)
        translate([0,0,h]) cylinder(r1=r-gap, r2=r+1, h=1); 
        translate([0,0,-1]) cylinder(r1=r+1, r2=r-gap, h=1); 
    }
}
```
