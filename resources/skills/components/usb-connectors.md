---
tags: [usb, connector, usb-a, usb-c, micro-usb, cutout, port, electronics]
---
# USB Connector Cutouts

Dimensions for USB port cutouts in enclosures.

## USB-A (Standard)

| Dimension | Value |
|-----------|-------|
| Width | 12.0 mm |
| Height | 4.5 mm |
| Cutout (with clearance) | 13.0 × 5.5 mm |
| Panel depth | 5-7 mm typical |

## USB-C

| Dimension | Value |
|-----------|-------|
| Width | 8.96 mm |
| Height | 2.4 mm |
| Cutout (with clearance) | 9.5 × 3.2 mm |
| Corner radius | 1.0-1.2 mm |

## Micro-USB

| Dimension | Value |
|-----------|-------|
| Width | 7.8 mm |
| Height | 2.7 mm |
| Cutout (with clearance) | 8.5 × 3.5 mm |
| Trapezoid offset | ~0.5 mm wider at bottom |

## Mini-USB

| Dimension | Value |
|-----------|-------|
| Width | 7.0 mm |
| Height | 3.9 mm |
| Cutout (with clearance) | 8.0 × 4.5 mm |

## OpenSCAD Modules

```openscad
// USB-A port cutout
module usb_a_cutout(depth=10) {
    w = 13.0;
    h = 5.5;
    translate([-w/2, -h/2, 0])
        cube([w, h, depth]);
}

// USB-C port cutout (rounded rectangle)
module usb_c_cutout(depth=10) {
    w = 9.5;
    h = 3.2;
    r = 1.0;
    
    linear_extrude(depth)
        offset(r=r)
            offset(r=-r)
                square([w, h], center=true);
}

// Micro-USB cutout (trapezoid shape)
module micro_usb_cutout(depth=10) {
    w_top = 8.0;
    w_bot = 8.5;
    h = 3.5;
    
    linear_extrude(depth)
        polygon([
            [-w_top/2, h/2],
            [w_top/2, h/2],
            [w_bot/2, -h/2],
            [-w_bot/2, -h/2]
        ]);
}

// Panel mount USB-A socket cutout (full assembly)
module usb_a_panel_mount(panel_thick=3) {
    // Main port hole
    usb_a_cutout(panel_thick + 2);
    
    // Mounting screw holes (common 24mm spacing)
    for (x = [-12, 12]) {
        translate([x, 0, 0])
            cylinder(d=3.2, h=panel_thick + 2, $fn=16);
    }
}
```

## Design Tips

1. **Add fillets**: Round the corners slightly for easier FDM printing
2. **Depth clearance**: Allow 2-3mm behind connector for cable bend
3. **Centering**: Measure from PCB reference points, not connector edges
4. **Tolerance**: Add 0.5-1mm to all dimensions for easy cable insertion
