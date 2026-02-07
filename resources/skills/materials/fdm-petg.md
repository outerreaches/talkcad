# PETG - FDM Printing Properties

PETG (Polyethylene Terephthalate Glycol) is a versatile 3D printing filament that offers a good balance of strength, flexibility, and ease of printing.

## Key Facts

- Print temperature: 220-250°C (nozzle), 70-80°C (bed)
- Shrinkage: ~0.3-0.5%
- Density: 1.27 g/cm³
- Glass transition: 80°C
- Good layer adhesion
- More flexible than PLA, less brittle

## Tolerances & Clearances

| Feature | Recommended Value |
|---------|-------------------|
| Horizontal clearance (sliding fit) | 0.25-0.35mm |
| Press fit interference | 0.1-0.15mm |
| Snap-fit clearance | 0.25-0.3mm |
| Thread clearance | 0.3-0.4mm |

## Design Guidelines

- **Minimum wall thickness**: 1.2mm (3 perimeters at 0.4mm nozzle)
- **Snap-fits**: PETG handles up to 4% strain, making it excellent for snap-fits
- **Overhangs**: Can handle 50-55° without supports due to slight stringing
- **Bridging**: Good bridging up to 50mm with proper cooling
- **Layer height**: 0.1-0.3mm typical

## Common Mistakes

- Printing too hot causes stringing and poor overhangs
- Insufficient cooling leads to drooping
- Too much squish on first layer causes elephant's foot
- PETG sticks to PEI too well - use glue stick as release agent

## OpenSCAD Patterns

```openscad
// PETG-optimized snap-fit tab
module petg_snap_tab(length=10, width=5, thickness=1.5) {
    clearance = 0.3;  // PETG snap-fit clearance
    deflection = length * 0.04;  // 4% max strain

    // Tab with 45° lead-in for printability
    hull() {
        cube([length, width, thickness]);
        translate([length-thickness, 0, deflection])
            cube([thickness, width, 0.1]);
    }
}
```
