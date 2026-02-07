---
tags: [rail, m-lok, mlok, magpul, tactical, mount, slot, accessory]
---
# M-LOK (Modular Lock)

The modern standard for lightweight accessory mounting (Magpul Industries).

## The Slot

M-LOK works by passing a T-nut through a slot and rotating it 90 degrees to lock.

| Dimension | Value |
|-----------|-------|
| Slot width | 7.0 mm (+0.1/-0.0) |
| Slot length | 32.0 mm |
| Corner radius | 2.38 mm |
| Slot spacing (edge-to-edge) | 8.0 mm |
| Plate thickness (optimal) | 2.0 - 3.5 mm |

## Mounting Pitch

| Dimension | Value |
|-----------|-------|
| Slot pitch (center-to-center) | 40.0 mm |
| Mounting hole spacing | 20.0 mm |
| Adjustment increments | 20.0 mm (half slot) |

**Note:** Accessories using two adjacent T-nuts have **20mm center-to-center** mounting hole spacing.

## Hardware

### T-Nut Dimensions

| Dimension | Value |
|-----------|-------|
| Length | 11.0-12.0 mm |
| Width | 6.9 mm |
| Thickness | 4.0-5.0 mm |
| Material | Steel (often phosphate coated) |

### Screw Specifications

| Specification | Value |
|---------------|-------|
| Standard thread | 10-24 UNC (most common) |
| Alternate threads | #8-32, M4, M5 |
| Head type | Button Head Cap Screw (BHCS) |
| Head diameter | ~7.5 mm |
| Hex key | 1/8" (3.18 mm) |
| Typical length | 3/8" (9.5 mm) |

### Torque Specs

| Application | Torque |
|-------------|--------|
| Metal to metal | 4.0 N⋅m (35 lb⋅in) |
| Polymer or mixed | 1.7 N⋅m (15 lb⋅in) |

## Picatinny Rail Adapters

For Picatinny rail profile dimensions (MIL-STD-1913), see: **[Picatinny Rail](../dimensions/picatinny-rail-mil-std-1913.md)**

M-LOK to Picatinny adapters typically use:
- **2 T-nuts** with 20mm mounting hole spacing
- Adapter secures to M-LOK slots, provides Picatinny rail on top

## OpenSCAD Module

```openscad
module mlok_slot_cutout(depth=10) {
    width = 7.1;   // Slight clearance
    length = 32.0;
    radius = 2.38;
    
    hull() {
        translate([-(length - width)/2, 0, 0]) cylinder(d=width, h=depth, center=true);
        translate([(length - width)/2, 0, 0]) cylinder(d=width, h=depth, center=true);
    }
}

module mlok_mounting_holes(slots=3, depth=10) {
    // Two holes at 20mm spacing for standard mount
    hole_spacing = 20;
    for (x = [-hole_spacing/2, hole_spacing/2]) {
        translate([x, 0, 0]) cylinder(d=4.5, h=depth, center=true); // For 10-24 screw
    }
}
```

## Source
- Magpul Industries M-LOK Specification
- Wikipedia: M-LOK

