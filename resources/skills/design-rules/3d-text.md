---
tags: [text, font, label, embossing, debossing, printing, legibility]
---
# 3D Text & Labeling

Putting words on parts (Version numbers, IO labels).

## Emboss (Stick Out) vs Deboss (Cut In)

### Debossing (Recommended for Z-face)
Cutting text *into* the top/bottom face is usually cleaner.
- **Depth**: 0.4mm - 0.6mm (2-3 layers). Deep enough to see shadows, shallow enough to bridge.
- **Bottom Face**: If printing face-down on a textured plate, debossed text looks professional.

### Embossing (Recommended for X/Y walls)
Sticking out from the side wall.
- **Height**: 0.4mm - 0.6mm.
- **Overhangs**: No support needed if stick-out is small.

## Minimum Sizes (Legibility)
*Assumes 0.4mm Nozzle.*

| Feature | Minimum | Recommended |
|---------|---------|-------------|
| **Font Size** | 5mm | 7mm+ |
| **Line Width** | 0.8mm (2 walls) | 1.0mm+ |
| **Depth/Height** | 0.4mm | 0.6mm |

## Font Choice
- **Use San-Serif**: Arial, Helvetica, Liberation Sans. Serifs (Times New Roman) have tiny details that fail to print.
- **Bold**: Always use **Bold**. It thickens the strokes.

## OpenSCAD Tip
The default `text()` module is 2D. You must linear_extrude it.

```openscad
// Center text on a block
module label_block(txt="V1.0") {
    difference() {
        cube([20, 10, 2]);
        // Deboss
        translate([10, 5, 2-0.4])
            linear_extrude(0.5)
            text(txt, size=5, font="Liberation Sans:style=Bold", halign="center", valign="center");
    }
}
```
