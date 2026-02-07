---
tags: [display, lcd, oled, screen, cutout, bezel, i2c, spi]
---
# Display Cutouts

Mounting dimensions for common displays used in electronics projects.

## OLED Displays

### 0.96" OLED (128×64, I2C/SPI)
| Dimension | Value |
|-----------|-------|
| Active area | 21.7 × 10.9 mm |
| PCB size | 27.0 × 27.0 mm |
| Mounting holes | 23.5 × 23.5 mm (M2) |
| Cutout (visible) | 23 × 12 mm |

### 1.3" OLED (128×64)
| Dimension | Value |
|-----------|-------|
| Active area | 29.4 × 14.7 mm |
| PCB size | 35.0 × 33.0 mm |
| Cutout | 31 × 16 mm |

## Character LCDs

### 16×2 LCD (HD44780)
| Dimension | Value |
|-----------|-------|
| Active area | 64.5 × 16.0 mm |
| PCB size | 80.0 × 36.0 mm |
| Mounting holes | 75.0 × 31.0 mm (M3) |
| Viewing cutout | 66 × 18 mm |

### 20×4 LCD
| Dimension | Value |
|-----------|-------|
| Active area | 76.0 × 26.0 mm |
| PCB size | 98.0 × 60.0 mm |
| Mounting holes | 93.0 × 55.0 mm (M3) |
| Viewing cutout | 78 × 28 mm |

## TFT Displays

### 1.8" TFT (128×160, ST7735)
| Dimension | Value |
|-----------|-------|
| Active area | 28.0 × 35.0 mm |
| PCB size | 34.0 × 55.0 mm |
| Cutout | 30 × 37 mm |

### 2.4" TFT (240×320, ILI9341)
| Dimension | Value |
|-----------|-------|
| Active area | 37.0 × 49.0 mm |
| PCB size | 42.0 × 60.0 mm |
| Cutout | 39 × 51 mm |

### 3.5" TFT (320×480)
| Dimension | Value |
|-----------|-------|
| Active area | 49.0 × 73.5 mm |
| PCB size | 56.0 × 97.0 mm |
| Cutout | 51 × 76 mm |

## OpenSCAD Modules

```openscad
// 0.96" OLED bezel and mount
module oled_096_cutout(depth=3) {
    // Viewing window
    translate([-11.5, -6, 0])
        cube([23, 12, depth]);
}

module oled_096_mount(panel_thick=2) {
    difference() {
        // Bezel frame
        translate([-14, -14, 0])
            cube([28, 28, panel_thick]);
        
        // Viewing cutout
        oled_096_cutout(panel_thick + 1);
        
        // Mounting holes (23.5mm pattern)
        for (x = [-11.75, 11.75]) {
            for (y = [-11.75, 11.75]) {
                translate([x, y, -0.1])
                    cylinder(d=2.2, h=panel_thick + 0.2, $fn=16);
            }
        }
    }
}

// 16x2 LCD mount
module lcd_16x2_cutout(depth=5) {
    // Viewing window
    translate([-33, -9, 0])
        cube([66, 18, depth]);
}

module lcd_16x2_mount_holes(depth=5) {
    // 75 × 31 mm pattern
    for (x = [-37.5, 37.5]) {
        for (y = [-15.5, 15.5]) {
            translate([x, y, 0])
                cylinder(d=3.2, h=depth, $fn=16);
        }
    }
}

// Generic display bezel
module display_bezel(w, h, border=3, panel_thick=2) {
    difference() {
        // Outer frame
        translate([-(w/2 + border), -(h/2 + border), 0])
            cube([w + border*2, h + border*2, panel_thick]);
        
        // Viewing cutout
        translate([-w/2, -h/2, -0.1])
            cube([w, h, panel_thick + 0.2]);
    }
}
```

## Design Tips

1. **Ribbon clearance**: Allow 10-15mm for flex cables
2. **Viewing angle**: Consider bezel depth vs viewing angle
3. **Light blocking**: Add small lip overlap (0.5-1mm) to hide LCD edge
4. **Touch screens**: No bezel overlap on touch-sensitive displays
5. **Contrast film**: Some LCDs need diffuser/polarizer - don't scratch!
