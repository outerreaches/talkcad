---
tags: [switch, button, rocker, toggle, momentary, cutout, panel, electronics]
---
# Switch Cutouts

Panel cutout dimensions for common switches.

## Rocker Switches

### Standard Rocker (KCD1 style)
| Dimension | Value |
|-----------|-------|
| Cutout | 19.0 × 13.0 mm |
| With tolerance | 19.5 × 13.5 mm |
| Panel thickness | 1-3 mm |

### Large Rocker (KCD4 style)
| Dimension | Value |
|-----------|-------|
| Cutout | 30.0 × 22.0 mm |
| With tolerance | 30.5 × 22.5 mm |

## Toggle Switches

### Mini Toggle (MTS series)
| Dimension | Value |
|-----------|-------|
| Mounting hole | 6.0 mm diameter |
| Thread | M6 × 0.75 |
| Panel thickness | up to 5 mm |

### Standard Toggle
| Dimension | Value |
|-----------|-------|
| Mounting hole | 12.0 mm diameter |
| Thread | 1/2"-32 or M12 |

## Momentary Buttons

### 6mm Tactile (Through-hole)
| Dimension | Value |
|-----------|-------|
| Button top | 3.5 mm diameter |
| Base | 6.0 × 6.0 mm |
| Height | 4.3-9.5 mm (varies) |
| Actuation | 0.25 mm travel |

### 12mm Momentary (Panel Mount)
| Dimension | Value |
|-----------|-------|
| Mounting hole | 12.0 mm |
| Bezel diameter | 14.0 mm |

### 16mm Momentary (Metal, LED)
| Dimension | Value |
|-----------|-------|
| Mounting hole | 16.0 mm |
| Bezel diameter | 18-19 mm |
| Thread length | 15-20 mm |

### 19mm Momentary (Industrial)
| Dimension | Value |
|-----------|-------|
| Mounting hole | 19.0 mm |
| Bezel diameter | 22 mm |

## OpenSCAD Modules

```openscad
// Rocker switch cutout (KCD1)
module rocker_switch_cutout(depth=5) {
    w = 19.5;
    h = 13.5;
    r = 1.5;  // Corner radius
    
    linear_extrude(depth)
        offset(r=r) offset(r=-r)
            square([w, h], center=true);
}

// Toggle switch mounting hole
module toggle_switch_hole(depth=5, d=6.2) {
    cylinder(d=d, h=depth, $fn=24);
}

// Momentary button panel hole
module button_hole(d=12.2, depth=5) {
    cylinder(d=d, h=depth, $fn=32);
}

// Tactile button pocket (for PCB mount)
module tactile_button_pocket(depth=3) {
    // Square pocket for 6x6mm tactile
    translate([-3.2, -3.2, 0])
        cube([6.4, 6.4, depth]);
    
    // Leg holes
    for (x = [-2.25, 2.25]) {
        for (y = [-3.25, 3.25]) {
            translate([x, y, 0])
                cylinder(d=1.2, h=depth + 2, $fn=12);
        }
    }
}

// LED button bezel (16mm style)
module led_button_bezel(panel_thick=3) {
    difference() {
        // Outer ring
        cylinder(d=22, h=2, $fn=48);
        // Center hole
        translate([0, 0, -0.1])
            cylinder(d=16.2, h=2.2, $fn=48);
    }
}
```

## Design Tips

1. **Panel thickness**: Most switches need 1-4mm panels
2. **Nut access**: Leave room behind panel for lock nuts
3. **Wire routing**: Plan 10-20mm depth for connections
4. **Grouping**: Space switches 25mm+ apart for finger access
