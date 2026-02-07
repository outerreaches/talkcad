---
tags: [picatinny, mil-std-1913, weaver, rail, tactical]
---

# Picatinny Rail (MIL-STD-1913)

![Schematic](./picatinny-rail-mil-std-1913.svg)

## Overview
The Picatinny rail (MIL-STD-1913) is a bracket used on firearms to provide a standardized mounting platform for accessories like scopes, lights, and grips.

## Cross-Section Dimensions

| Dimension | Value |
|-----------|-------|
| Overall width | 21.2 mm |
| Slot-to-slot width | 15.67 mm |
| Height (rail profile) | 9.32 mm |
| Slot angle | 45° |

## Slot Pattern

| Dimension | Value |
|-----------|-------|
| Slot pitch (center-to-center) | 10.0 mm |
| Slot width | 5.25 mm |
| Slot depth | 3.0 mm |

## OpenSCAD Notes

```openscad
// Picatinny rail cross-section parameters
picatinny_width = 21.2;
picatinny_slot_width = 15.67;
picatinny_height = 9.32;
picatinny_slot_pitch = 10.0;
picatinny_slot_opening = 5.25;
picatinny_slot_depth = 3.0;
picatinny_slot_angle = 45;

// The slot profile is a trapezoid:
// - Top (opening): 5.25mm
// - Bottom: narrower due to 45° walls
// - Depth: 3.0mm
```

## Source
- MIL-STD-1913 specification
- Schematic: Wikimedia Commons

## See Also
- Weaver rail (similar but different slot spacing)
