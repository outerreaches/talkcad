---
tags: [knob, potentiometer, encoder, shaft, d-shaft, spline, interface]
---
# Knob Shaft Interfaces

Mounting printed knobs to electronics.

## 1. D-Shaft (6mm)
The most common potentiometer shaft.
- **Diameter**: 6.0 mm.
- **Flat Depth**: 4.5 mm from opposite wall (1.5mm cut).
- **Tolerance**: Print tight! (5.9mm - 6.0mm) or it will wobble.

```openscad
module d_shaft_socket(h=10, clearance=0.15) {
    d = 6.0 + clearance;
    flat_dist = 4.5 + clearance/2;
    
    intersection() {
        cylinder(d=d, h=h);
        // The flat cut
        translate([0, -5, 0])
            cube([flat_dist * 2, 10, h*2], center=true); // Shifted cube
    }
}
```

## 2. Knurled / Spline Shaft (T18)
Common on cheap pots. Hard to print the teeth perfectly.
- **Hack**: Print a slightly undersized **Hexagon** or **Octagon**. The metal splines will bite into the plastic.
- **Diameter**: ~6.0mm.
- **Hole**: 5.8mm Octagon.

## 3. Set Screw (Grub Screw)
For smooth shafts.
- Use a **M3 Nut Trap** in the side of the knob.
- Screw pushes against the shaft.
- *Tip*: Adding a nut trap balanced on the opposite side keeps the knob spinning true (counterweight).

## Design Pattern: The Spring Collet
Instead of a hard hole, cut a slot in the knob shaft so it can flex open slightly.
```openscad
module flexible_d_shaft(h=10) {
    d_shaft_socket(h);
    // Expansion slot
    cube([1, 10, h*2], center=true); 
}
```
