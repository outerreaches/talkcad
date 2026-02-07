---
tags: [magnet, neodymium, n52, closure, snap, press-fit]
---
# Neodymium Magnets

Used for case closures, sensor triggers, and detachable mounts.

## Common Sizes (Cylinder)
- **6mm x 3mm**: The "standard" small magnet.
- **3mm x 3mm**: Tiny.
- **10mm x 2mm**: Low profile, strong.

## Mounting Strategy: Press Fit
Magnets are brittle and slippery. Glue is messy. Press-fitting is best.

1.  **Hole Diameter**: Nominal + 0.1mm - 0.2mm tolerance.
    - *Example*: For 6mm magnet, print 6.1mm - 6.2mm hole.
2.  **Hole Depth**: Deep enough to be flush or slightly recessed (-0.1mm).
3.  **Chamfer**: Add a 0.5mm chamfer to the top of the hole to guide the magnet in.
4.  **Burying**: You can pause the print, insert the magnet, and print over it to seal it inside. (Ensure magnet is flush or nozzle will hit it!).

## Polarity Warning
When designing closures (Mag-to-Mag):
- **Mark the holes!** It's easy to glue one in backward and have a case that repels itself.
- **Mag-to-Steelscrew**: Using a magnet on one side and a steel screw head on the other sidesteps polarity issues entirely.

## OpenSCAD Module

```openscad
module magnet_pocket(d=6.1, h=3.1) {
    cylinder(d=d, h=h);
    // Chamfer
    translate([0,0,-0.1]) cylinder(d1=d-0.5, d2=d, h=0.5);
}
```
