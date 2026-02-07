---
tags: [hinge, compliant, flexible, polypropylene, pp, petg, joint]
---
# Living Hinges

A thin section of material that bends to act as a hinge.

## Materials
1.  **Polypropylene (PP)**: The king of living hinges (Tic-Tac boxes). Infinite fatigue life. Hard to print.
2.  **PETG**: Good fatigue life. Works for occasional use (latches, cases).
3.  **PLA**: **Avoid**. Will turn white (stress craze) and snap after 5-10 bends.
4.  **TPU**: Excellent, indestructible hinge.

## Design Geometry

### 1. The Simple Thin Strip
- **Thickness**: 0.4mm - 0.6mm (2-3 layers solid).
- **Length**: The length of the bridge determines the bend radius.
    - Short (1mm) = Sharp bend, high stress.
    - Long (3mm) = Radius bend, lower stress.

### 2. The "Lattice" Hinge (Wood/PLA)
For brittle materials (PLA/Wood), you cut a pattern of alternating slots. This distributes the bend over a large area (torsion) rather than bending the material directly.
*Search: "Laser cut kerf bending patterns"*

## Printing Orientation
For a solid living hinge, the **extrusion lines must run across the hinge** (perpendicular to the axis of rotation).
- *Bad*: Layers run parallel to hinge (Snap!).
- *Good*: Continuous extrusion path across the gap.

## OpenSCAD Module

```openscad
module living_hinge_segment(width=20, length=2, thickness=0.6) {
    // Simple flat bridge
    cube([width, length, thickness]);
    
    // Strain relief radii at ends (IMPORTANT)
    // Prevents tearing at the connection point
    translate([0, 0, thickness]) 
        rotate([0,90,0]) 
        linear_extrude(width) 
        polygon([[0,0], [1,0], [0,1]]); // Chamfer/Fillet
}
```
