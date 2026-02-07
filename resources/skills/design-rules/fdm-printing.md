---
tags: [fdm, 3d-printing, design-rules, tolerances, walls, overhangs]
---
# FDM 3D Printing Design Rules

## Wall Thickness
- **Minimum wall**: 1.2mm (~3 perimeters at 0.4mm nozzle with typical line width)
- **Recommended wall**: 1.6-2.0mm (4-5 perimeters)
- **Structural walls**: 2.4mm+ for load-bearing parts

## Overhangs
- **Safe angle**: ≤45° from vertical (no supports needed)
- **Bridging**: 10-20mm typical safe span; up to 50mm possible with good cooling and tuning
- **Support-free designs**: Use chamfers instead of fillets on undersides

## Tolerances (FDM with 0.4mm nozzle)
| Fit Type | Clearance | Use Case |
|----------|-----------|----------|
| Press fit | 0.0-0.1mm | Permanent assembly |
| Snug fit | 0.1-0.2mm | Friction fit, removable with force |
| Sliding fit | 0.2-0.3mm | Moving parts, hinges |
| Loose fit | 0.3-0.5mm | Easy assembly, lids |

## Material-Specific Tolerances
| Material | Shrinkage | Recommended Clearance |
|----------|-----------|----------------------|
| PLA | ~0.3% | 0.2mm |
| PETG | ~0.5% | 0.25mm |
| ABS | ~0.8% | 0.3mm |
| TPU | ~1-2% | 0.4mm |

## Holes and Threads
- **Horizontal holes**: Print 0.4-0.5mm undersize, ream to fit
- **Vertical holes**: Print at nominal size
- **Threaded inserts**: Hole = insert OD - 0.3mm
- **Self-tapping screws**: Hole = screw OD - 0.5mm

## Snap-Fit Guidelines
- **Cantilever length**: 10-20mm for good flex
- **Beam thickness**: 1.5-2.5mm
- **Deflection**: Max 3-5% of length
- **Undercut angle**: 30-45° for easy insertion
- **Retention lip**: 0.5-1mm depth

## Layer Lines
- **Print orientation**: Strongest perpendicular to layer lines
- **Avoid**: Thin walls parallel to print bed (weak layer adhesion)
- **Stress points**: Orient so layers don't split under load

## Source
Based on Prusa, Ultimaker, and community best practices.
