---
tags: [tripod, camera, mount, photography, 1/4-20, unc, thread]
---
# Tripod Mount (1/4"-20 UNC)

The universal standard for mounting cameras and accessories.

## Specs
- **Thread**: 1/4 inch diameter, 20 threads per inch (UNC).
- **Major Diameter**: ~6.35 mm (0.25 in).
- **Pitch**: ~1.27 mm.

## Printing threads vs Tapping
FDM printers struggle with fine internal 1/4-20 threads.
1.  **Tapping (Best)**: Print a 5.0mm - 5.2mm hole and use a metal tap.
2.  **Modeling (Okay)**: Use `threads.scad` but print slow.
3.  **Nut Trap (Easiest)**: Embed a metal 1/4-20 nut.

## OpenSCAD Module (Modeled Thread)
*Requires `threads.scad`*

```openscad
use <threads.scad>;

module tripod_socket() {
    // 1/4" = 6.35mm
    // Pitch = 25.4 / 20 = 1.27mm
    // Depth standard = 6mm - 7mm
    
    major_d = 0.25 * 25.4; 
    pitch = 25.4 / 20;
    
    ScrewHole(outer_diam=major_d, height=8, pitch=pitch, tolerance=0.4) {
        cylinder(d=15, h=10); // The boss around it
    }
}
```

## The "Cold Shoe" / "Hot Shoe"
The square bracket on top of cameras for flashes.
- **Width**: 18.5 mm.
- **Thickness**: 2.0 mm.
- **Design**: Slide-in fit.
