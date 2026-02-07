---
tags: [arduino, uno, r3, electronics, microcontroller, mounting, pcb]
---
# Arduino Uno R3

Standard microcontroller board dimensions for case design.

## Dimensions
- **PCB Size**: 68.6mm × 53.4mm (approx)
- **Irregular Shape**: The PCB is not a perfect rectangle; it has a cutout near the USB connector.
- **Max Height**: ~15mm (USB-B connector / headers)

## Mounting Holes
- **Hole Diameter**: 3.2mm (fits M3 screws, but tight; M2.5 recommended with washers)
- **Count**: 4 unplated holes
- **Positions** (Relative to bottom-left corner 0,0 - assuming USB is Left):
    1.  (14.0mm, 2.5mm)
    2.  (66.0mm, 7.6mm)
    3.  (66.0mm, 35.6mm)
    4.  (15.2mm, 50.8mm)

*Note: Coordinates vary slightly by clone manufacturer. Use generous clearance.*

## Connector Locations (Projecting)
Relative to the PCB edge:
1.  **USB Type-B**:
    - Left edge
    - Center Y: ~39mm from bottom edge
    - Width: ~12mm
    - Height: ~11mm
2.  **DC Barrel Jack**:
    - Left edge
    - Center Y: ~9mm from bottom edge
    - Diameter: ~9mm hole typically needed

## Shield Clearance
- Arduino "Shields" stack on top. Allow at least **20mm vertical clearance** if accommodating shields.

## OpenSCAD Mockup Module
```openscad
module arduino_uno_r3() {
    color("Teal") {
        // Main PCB (Simplified rectangle for bounds)
        cube([68.6, 53.4, 1.6]);
    }
    // USB Connector
    color("Silver") translate([-6, 33, 1.6]) cube([16, 12, 11]);
    // DC Jack
    color("Black") translate([-2, 4, 1.6]) cube([14, 9, 11]);
    // Headers (Generic blocks)
    color("Black") translate([18, 48, 1.6]) cube([45, 2.5, 8.5]);
    color("Black") translate([21, 1, 1.6]) cube([30, 2.5, 8.5]);
}
```
