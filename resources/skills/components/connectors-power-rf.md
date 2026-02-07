---
tags: [connector, xt60, xt30, sma, rp-sma, antenna, power, pigtail]
---
# Power & RF Connectors

Standard cutouts for panel-mounting common drone connectors.

## XT60 / XT30 (Amass)
There are "panel mount" versions with ears, but often you just want to bury the connector in a TPU holder.

### Dimensions (Standard Male Plug)
- **XT60**: ~15.5mm × 8.1mm (chamfered).
- **XT30**: ~10.2mm × 5.2mm (chamfered).

> **Note**: For panel mounting, it is often easier to make a rectangular slot and use 3M VHB tape or CA glue, or design a "TPU sleeve" that grips the connector body tightly.

## SMA / RP-SMA (Antenna)
The gold plated antenna connector.
- **Thread**: 1/4"-36 UNS (approx 6.35mm OD).
- **Cutout**: 6.5mm circular hole is standard.
- **Flats**: Many pigtails have a "D-cut" or two flats to prevent rotation.
    - Flat-to-flat width: ~5.9mm.

## OpenSCAD Modules

```openscad
module sma_cutout(is_flattened=true) {
    // The cylinder
    intersection() {
        cylinder(d=6.5, h=10, center=true);
        if (is_flattened) {
             // Anti-rotation flats
             cube([5.9, 10, 10], center=true);
        }
    }
}

module xt60_cutout_tpu() {
    // A tight profile for flex (TPU) mounting
    // Chamfered side approximation
    hull() {
        translate([-4, 7.5, 0]) cylinder(r=0.5, h=15, center=true);
        translate([4, 7.5, 0]) cylinder(r=0.5, h=15, center=true);
        translate([-2, -7, 0]) cylinder(r=0.5, h=15, center=true); // Chamfered bottom
        translate([2, -7, 0]) cylinder(r=0.5, h=15, center=true);
    }
}
```
