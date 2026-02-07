---
tags: [raspberry-pi, rpi, pi4, pi5, pi-zero, case, enclosure, sbc]
---
# Raspberry Pi Dimensions

Standard dimensions for Raspberry Pi boards and mounting.

## Raspberry Pi 4 Model B

| Dimension | Value |
|-----------|-------|
| Board size | 85.6 × 56.5 mm |
| Board thickness | 1.4 mm |
| Total height (with components) | ~17 mm |
| USB-A ports height | 16 mm |
| Ethernet port height | 13.5 mm |

### Mounting Holes

- **Hole diameter**: 2.7 mm (M2.5 clearance)
- **Recommended screw**: M2.5
- **Standoff height**: 3-5 mm minimum

**Hole positions (from bottom-left corner):**
| Hole | X | Y |
|------|---|---|
| 1 | 3.5 mm | 3.5 mm |
| 2 | 3.5 mm | 52.5 mm |
| 3 | 61.5 mm | 3.5 mm |
| 4 | 61.5 mm | 52.5 mm |

### Port Positions (from left edge)

| Port | Position | Notes |
|------|----------|-------|
| USB-C power | 7.7 mm | Bottom edge |
| Micro HDMI 0 | 26 mm | Bottom edge |
| Micro HDMI 1 | 39.5 mm | Bottom edge |
| Audio jack | 54 mm | Bottom edge |
| USB 2.0 (×2) | Right edge | 9 mm from bottom |
| USB 3.0 (×2) | Right edge | 27 mm from bottom |
| Ethernet | Right edge | 45.75 mm from bottom |
| GPIO header | Top edge | 40 pins, 2.54mm pitch |

## Raspberry Pi 5

| Dimension | Value |
|-----------|-------|
| Board size | 85 × 56 mm |
| Total height | ~17 mm |

Mounting holes same as Pi 4.

## Raspberry Pi Zero 2 W

| Dimension | Value |
|-----------|-------|
| Board size | 65 × 30 mm |
| Board thickness | 1.4 mm |
| Total height | ~5 mm |

**Mounting holes**: 58 × 23 mm pattern, 2.7 mm diameter

## Enclosure Design Guidelines

- **Internal clearance**: Add 2-3 mm around board
- **Port cutouts**: Add 0.5-1 mm clearance
- **Ventilation**: Include vents near CPU/Ethernet
- **SD card access**: Need ~3 mm below board
- **GPIO access**: Consider pin header access if needed

## OpenSCAD Patterns

```openscad
// Raspberry Pi 4 mounting pattern
module pi4_mount_holes(height=5, hole_d=2.7) {
    positions = [
        [3.5, 3.5],
        [3.5, 52.5],
        [61.5, 3.5],
        [61.5, 52.5]
    ];

    for (pos = positions) {
        translate([pos[0], pos[1], 0])
            cylinder(d=hole_d, h=height, $fn=16);
    }
}

// Standoff for Pi mounting
module pi_standoff(h=5, screw_d=2.5, outer_d=6) {
    difference() {
        cylinder(d=outer_d, h=h, $fn=32);
        cylinder(d=screw_d, h=h+0.1, $fn=16);
    }
}

// Basic Pi 4 enclosure base
module pi4_enclosure_base(wall=2, clearance=2, standoff_h=5) {
    board_x = 85.6;
    board_y = 56.5;
    inner_x = board_x + clearance * 2;
    inner_y = board_y + clearance * 2;

    difference() {
        // Outer shell
        cube([inner_x + wall*2, inner_y + wall*2, standoff_h + wall]);

        // Inner cavity
        translate([wall, wall, wall])
            cube([inner_x, inner_y, standoff_h + 1]);
    }

    // Standoffs
    translate([wall + clearance, wall + clearance, wall]) {
        pi4_mount_holes(standoff_h, 2.2);  // Tap holes for M2.5
    }
}
```
