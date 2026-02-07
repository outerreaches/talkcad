---
tags: [dc, barrel, jack, power, connector, 5521, 5525, cutout]
---
# DC Barrel Jack Connectors

Common DC power connector dimensions for electronics projects.

## Standard Sizes

| Type | Outer Ø | Inner Ø (Pin) | Common Use |
|------|---------|---------------|------------|
| 5.5×2.1 | 5.5 mm | 2.1 mm | Arduino, most devices |
| 5.5×2.5 | 5.5 mm | 2.5 mm | Laptops, higher power |
| 3.5×1.35 | 3.5 mm | 1.35 mm | Small devices |

## Panel Mount Jack Dimensions

### Standard 5.5×2.1 / 5.5×2.5
| Dimension | Value |
|-----------|-------|
| Mounting hole | 8.0 mm |
| Body diameter | 11-12 mm |
| Thread length | 10-12 mm |
| Nut width | 10 mm (hex) |

### Breadboard/PCB Mount
| Dimension | Value |
|-----------|-------|
| Body | 9.0 × 11.0 × 14.0 mm (varies) |
| Pin spacing | 2.54 mm (0.1") |

## OpenSCAD Modules

```openscad
// Panel mount hole for 5.5mm barrel jack
module barrel_jack_hole(depth=5) {
    // Main mounting hole
    cylinder(d=8.2, h=depth, $fn=24);
}

// Full panel mount cutout with nut clearance
module barrel_jack_panel_mount(panel_thick=3) {
    // Mounting hole
    cylinder(d=8.2, h=panel_thick + 2, $fn=24);
    
    // Hex nut recess (front side, countersunk)
    translate([0, 0, panel_thick - 1])
        cylinder(d=12, h=2, $fn=6);
}

// PCB mount barrel jack pocket
module barrel_jack_pcb_pocket() {
    // Main body pocket
    translate([-4.5, -5.5, 0])
        cube([9, 11, 14]);
    
    // Pin clearance
    translate([0, -7, 0])
        cylinder(d=2, h=3, $fn=12);
    translate([0, 3, 0])
        cylinder(d=2, h=3, $fn=12);
}

// Barrel plug clearance (for cable exit)
module barrel_plug_clearance(depth=20) {
    union() {
        // Plug body
        cylinder(d=10, h=depth-5, $fn=24);
        // Strain relief/cable
        translate([0, 0, depth-5])
            cylinder(d=6, h=10, $fn=16);
    }
}
```

## USB-C PD Alternative

Modern designs increasingly use USB-C for power. Consider USB-C for:
- 5V, 9V, 12V, 15V, 20V selectable (with PD trigger)
- Up to 100W (20V × 5A)
- Reversible connector
- See `usb-connectors.md` for cutout dimensions

## Design Tips

1. **Polarity**: Center pin is usually positive (check device!)
2. **Strain relief**: Add internal cable catch or external grip
3. **Spacing**: Keep 15mm+ from other connectors
4. **Depth**: Allow 15-20mm behind panel for plug insertion
