---
tags: [wheel, roller, tire, axle, hub, robot, motion]
---
# Wheels and Rollers

Design parameters for wheels, rollers, and axle systems.

## Common Wheel Sizes

| Diameter | Width | Typical Use |
|----------|-------|-------------|
| 30 mm | 10 mm | Small robots, casters |
| 50 mm | 20 mm | Desktop robots |
| 65 mm | 26 mm | Robot chassis kits |
| 80 mm | 30 mm | Larger robots |
| 100 mm | 30 mm | Heavy duty |

## Axle/Hub Interface

### D-Shaft (Hobby Motors)
| Motor | Shaft Ø | Flat Depth |
|-------|---------|------------|
| TT Motor | 5.0 mm | 0.5 mm |
| N20 | 3.0 mm | 0.5 mm |
| 550/775 | 5.0 mm | 0.5 mm |

### Set Screw Hubs
- Bore matches motor shaft
- M3 set screw perpendicular to axis
- Hub OD: 8-12 mm typical

### Press-Fit
| Shaft Ø | Hub Bore (tight) | Hub Bore (removable) |
|---------|------------------|----------------------|
| 3 mm | 2.9 mm | 3.1 mm |
| 5 mm | 4.9 mm | 5.1 mm |
| 6 mm | 5.9 mm | 6.1 mm |
| 8 mm | 7.9 mm | 8.1 mm |

## O-Ring Tire

Adding rubber grip with standard O-rings:

| Wheel OD (groove) | O-Ring ID | O-Ring CS |
|-------------------|-----------|-----------|
| 25 mm | 22 mm | 2.5 mm |
| 40 mm | 36 mm | 3.0 mm |
| 60 mm | 54 mm | 4.0 mm |

**Groove depth** ≈ 0.7 × cross-section diameter

## OpenSCAD Modules

```openscad
// Basic wheel with D-shaft hub
module wheel(od=50, width=20, shaft_d=5, flat=0.5) {
    hub_d = shaft_d * 2 + 4;
    hub_len = width * 0.8;
    
    difference() {
        union() {
            // Wheel body
            cylinder(d=od, h=width, $fn=64);
        }
        
        // D-shaft hole
        translate([0, 0, -0.1])
            d_shaft_hole(shaft_d, flat, width + 0.2);
        
        // Weight reduction (spokes)
        spoke_count = 5;
        for (i = [0:spoke_count-1]) {
            rotate([0, 0, i * 360/spoke_count])
                translate([od/4, 0, width/2])
                    cylinder(d=od/4, h=width+0.2, center=true, $fn=24);
        }
    }
}

// D-shaft hole (flat on one side)
module d_shaft_hole(d, flat, h) {
    difference() {
        cylinder(d=d + 0.2, h=h, $fn=24);
        translate([d/2 - flat, -d, -0.1])
            cube([d, d*2, h+0.2]);
    }
}

// Wheel with O-ring tire groove
module wheel_with_oring(od=50, width=20, oring_cs=3) {
    groove_depth = oring_cs * 0.7;
    
    difference() {
        wheel(od, width);
        
        // O-ring groove
        translate([0, 0, width/2])
            rotate_extrude($fn=64)
                translate([od/2 - groove_depth/2, 0])
                    circle(d=oring_cs + 0.5, $fn=24);
    }
}

// Roller (smooth cylinder)
module roller(od=20, length=50, bore=8) {
    difference() {
        cylinder(d=od, h=length, $fn=48);
        translate([0, 0, -0.1])
            cylinder(d=bore, h=length+0.2, $fn=24);
    }
}

// Omni wheel segment (simplified)
module omni_roller(main_d=60, roller_d=10, roller_count=8) {
    for (i = [0:roller_count-1]) {
        rotate([0, 0, i * 360/roller_count])
            translate([main_d/2 - roller_d/2, 0, 0])
                rotate([0, 90, 0])
                    cylinder(d=roller_d, h=12, center=true, $fn=24);
    }
}
```

## Design Tips

1. **Print orientation**: Wheel axis vertical for round profile
2. **Infill**: 20-30% for light weight, 50%+ for durability
3. **Traction**: Add knurling, grooves, or O-ring tires
4. **Balance**: Make spoke pattern symmetric
5. **Bearing interface**: Use 608 bearings for smooth rotation
