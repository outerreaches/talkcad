---
tags: [thread, tpi, pitch, imperial, metric, conversion, inch, mm]
---
# Units, Measures, and Thread Conversions (Quick Reference)

## Core unit conversion

- **1 inch = 25.4 mm**

## Thread pitch conversions (TPI ↔ pitch)

For Unified/Imperial threads written like `major_diameter - TPI` (e.g. `1/2"-28`):

- **Pitch (mm)**: `pitch_mm = 25.4 / TPI`
- **TPI**: `TPI = 25.4 / pitch_mm`

### Worked examples

- **1/2"-28**
  - Major diameter: `0.500 in = 12.700 mm`
  - Pitch: `25.4 / 28 = 0.907 mm`

- **5/8"-24**
  - Major diameter: `0.625 in = 15.875 mm`
  - Pitch: `25.4 / 24 = 1.058 mm`

- **3/8"-16**
  - Major diameter: `0.375 in = 9.525 mm`
  - Pitch: `25.4 / 16 = 1.588 mm`

## Modeling guidance

- For parametric modeling, you usually need:
  - **major diameter** (mm)
  - **pitch** (mm)
  - **thread length** (mm)
  - a **tolerance/clearance** appropriate for printing

Note: **minor diameter depends on the exact thread form and class of fit**. If you don’t have a table, use a conservative clearance and test-fit.

