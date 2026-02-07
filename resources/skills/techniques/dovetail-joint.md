---
tags: [joint, dovetail, slide, connection, linear-motion, woodworking, joinery]
---
# Dovetail Joinery & Slides

A classic geometric lock that provides 1-axis constraint (sliding) or permanent joining. Very printable.

## Parameters
- **Width**: The widest part of the tail.
- **Angle**: Typically 60° (classic) or 45°. Steeper = stronger lock, harder to slide.
- **Height**: Thickness of the joint.
- **Clearance**: Critical for sliding vs. friction fit.
    - **Sliding**: 0.2mm - 0.3mm gap.
    - **Friction**: 0.05mm - 0.1mm gap.

## OpenSCAD Module

```openscad
// A simple 2D dovetail profile to be linear_extruded
// width: max width at top
// height: vertical depth
// angle: dovetail angle inside (typ 60)
module dovetail_profile(width=10, height=5, angle=60) {
    // Calculate narrow bottom width based on geometry
    // tan(angle) = opp/adj
    narrow_w = width - 2 * (height / tan(angle));
    
    polygon(points=[
        [-width/2, height], // Top Left
        [width/2, height],  // Top Right
        [narrow_w/2, 0],    // Bottom Right
        [-narrow_w/2, 0]    // Bottom Left
    ]);
}

// The Cutter (The Slot / Female)
// Includes clearance!
module dovetail_socket(len=30, width=10, height=5, clearance=0.2) {
    translate([0, -len/2, 0])
        rotate([-90, -90, 0]) // Orient for cutting horizontally
        linear_extrude(len)
        dovetail_profile(width + clearance, height, 60);
}

// The Pin (The Tail / Male)
module dovetail_pin(len=30, width=10, height=5) {
    translate([0, -len/2, 0])
        rotate([-90, -90, 0])
        linear_extrude(len)
        dovetail_profile(width, height, 60);
}
```

## Applications
1.  **Linear Slide**: A simple 1-axis stage for sensors or cameras. Use grease/lubricant.
2.  **Mounting Plates**: "Slide to lock" mechanism for wall mounts.
3.  **Modular Connectors**: Join two halves of a large object with strong tensile resistance.

## Printing Tips
- **Orientation**: Print the dovetail cross-section on the bed (Z-axis) for maximum accuracy.
- **Edges**: Add small chamfers to the sharp acute angles if possible, as they can curl or be fragile.
