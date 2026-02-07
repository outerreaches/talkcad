---
tags: [latch, toggle, clamp, draw-latch, box, closure, locking]
---
# Toggle (Over-Center) Latch

A partially compliant mechanism to clamp lids shut tight. Uses leverage to pull surfaces together.

## Mechanism Types

1.  **Rigid Draw Latch**: Needs a metal wire bail (like a jar latch). Hard to verify.
2.  **Compliant Draw Latch (Recommended)**: A purely printed latch where the "loop" is thin plastic that stretches slightly to provide tension.

## Printed Design Pattern
*Commonly known as the "Rugged Box Latch".*

### Components
1.  **The Hook (on Lid)**: A simple lip or catch.
2.  **The Lever (on Box)**: Rotates on a screw/pin.
3.  **The Link (Compliant)**: Connected to the Lever. Stretches over the Hook.

### Key Geometry (The "Over Center")
The pivot point of the Link must pass *below* the line of force to lock.
- **Open**: Link pivot is above the line connecting Lever Pivot and Hook.
- **Locked**: Link pivot is **below** the line connecting Lever Pivot and Hook. Tension holds it closed.

## Material Requirement
- **PETG**: Excellent. Flexible enough to stretch, stiff enough to hold.
- **PLA**: Will work initially but "creep" (relax) over time, making the latch loose.

## OpenSCAD Module (Simple Catch)
The active part is complex, but the *receiving* catch on your box is simple:

```openscad
// Subtract this from your Lid to make a catch for a generic latch
module latch_catch_cutout() {
    width = 20;
    
    // The recess
    translate([0, 5, 0])
        cube([width, 10, 10], center=true);
        
    // The Lip (The latch grabs this)
    // Modeled as a solid bar across the recess
    translate([0, 5, 3])
        rotate([0, 90, 0])
        cylinder(d=3, h=width, center=true);
}
```
