---
tags: [system, validation, fdm, sla, manufacturing]
---
# Design Validation Rules

## Before Presenting a Design, Verify:
- Walls ≥1.2mm for FDM (≥0.5mm for SLA)
- No overhangs >45° without supports
- Appropriate clearances for specified material
- Dimensions make sense for intended purpose
- Mesh is manifold (no errors)

## FDM-Specific Rules
- Minimum wall thickness: 1.2mm (0.4mm nozzle × 3 perimeters)
- Minimum feature size: 0.4mm
- Hole diameter compensation: +0.2mm for tight fit, +0.4mm for loose fit
- Maximum unsupported overhang: 45°
- Maximum bridge span: 10mm without sag

## Clearances (FDM PLA/PETG)
- Press/interference fit: -0.05 to -0.15mm (negative = interference)
- Snug fit: 0.1-0.2mm clearance
- Sliding fit: 0.2-0.3mm clearance
- Loose fit: 0.3-0.5mm clearance
- Threaded connections: 0.3mm clearance

For detailed tolerance tables, see `design-rules/fdm-printing.md`.

## SLA-Specific Rules
- Minimum wall thickness: 0.5mm
- Minimum feature size: 0.1mm
- Supports needed for horizontal surfaces
- Drainage holes for hollow parts (≥3mm diameter)

## Common Issues to Check
1. Thin walls that won't print
2. Missing tolerances for fits
3. Overhangs that need supports
4. Sharp corners (consider fillets for FDM)
5. Unsupported horizontal surfaces
