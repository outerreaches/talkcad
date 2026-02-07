---
tags: [fdm, 3d-printing, design-rules, overhangs, bridging, orientation]
---
# FDM Design Rules

Guidelines for designing 3D printable parts using Fused Deposition Modeling (FDM).

## Key Facts

- Layer-by-layer process, bottom to top
- Each layer must be supported by the layer below
- Overhangs >45° typically need supports
- Print orientation significantly affects strength

## Minimum Feature Sizes

| Feature | Minimum | Recommended |
|---------|---------|-------------|
| Wall thickness | 0.8mm (2 perimeters) | 1.2-2.0mm |
| Hole diameter | 2mm | 3mm+ |
| Pin diameter | 3mm | 4mm+ |
| Text height | 1.5mm | 2mm+ embossed |
| Horizontal gap | 0.4mm | 0.5mm |
| Vertical clearance | 0.2mm | 0.3mm |

## Overhang Rules

- **0-45°**: No support needed
- **45-55°**: May work with good cooling
- **55-90°**: Requires support or redesign

### Design Alternatives to Supports

1. **Chamfer overhangs at 45°**
   ```openscad
   // Instead of 90° overhang
   module chamfered_overhang(width, depth, height) {
       hull() {
           cube([width, depth, 0.1]);
           translate([0, 0, height])
               cube([width, depth - height, 0.1]);
       }
   }
   ```

2. **Use teardrop shapes for horizontal holes**
   ```openscad
   module teardrop_hole(d, h) {
       union() {
           cylinder(d=d, h=h);
           rotate([0, 0, 45])
               cylinder(d=d/sqrt(2), h=h, $fn=4);
       }
   }
   ```

## Bridging

- **Max reliable bridge**: 20-30mm with cooling
- **Extended bridges**: Up to 50mm with slow speed and max fan
- Design bridges along print X/Y axes when possible

## Part Orientation

| Goal | Orientation |
|------|-------------|
| Max strength | Load perpendicular to layers |
| Best surface | Most visible face up or against bed |
| Minimize supports | Overhangs facing up |
| Tight tolerances | Critical dimensions in X/Y (not Z) |

## Common Mistakes

- Designing thin walls parallel to print direction (weak)
- Small holes in Z direction (oval due to squish)
- Sharp inside corners (stress concentrators)
- Forgetting shrinkage compensation

## OpenSCAD Patterns

```openscad
// FDM-safe fillet for inside corners
module fdm_fillet(r=2, h=10) {
    difference() {
        cube([r, r, h]);
        translate([r, r, -0.1])
            cylinder(r=r, h=h+0.2, $fn=32);
    }
}

// Printable horizontal hole (teardrop)
module printable_hole(d, h) {
    rotate([-90, 0, 0])
        union() {
            cylinder(d=d, h=h, $fn=32);
            translate([0, d/2 * 0.7, 0])
                rotate([0, 0, 45])
                    cylinder(d=d * 0.7, h=h, $fn=4);
        }
}
```
