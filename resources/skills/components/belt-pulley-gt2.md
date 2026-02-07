---
tags: [belt, pulley, gt2, timing, motion, stepper, 3d-printer, cnc]
---
# GT2 Timing Belts and Pulleys

The standard belt system for 3D printers and CNC machines.

## GT2 Belt Specifications

| Parameter | Value |
|-----------|-------|
| Pitch | 2.0 mm |
| Belt width | 6 mm (standard), 9 mm, 10 mm |
| Tooth depth | 0.75 mm |
| Belt thickness | ~1.5 mm |

## Common Pulley Sizes

| Teeth | Pitch Diameter | OD (approx) |
|-------|----------------|-------------|
| 16T | 10.19 mm | 11.5 mm |
| 20T | 12.73 mm | 14.0 mm |
| 30T | 19.10 mm | 20.5 mm |
| 36T | 22.92 mm | 24.5 mm |
| 40T | 25.46 mm | 27.0 mm |
| 60T | 38.20 mm | 40.0 mm |
| 80T | 50.93 mm | 53.0 mm |

**Pitch Diameter Formula**: `PD = (teeth × pitch) / π = teeth × 2 / 3.14159`

## Idler Specifications

### Toothed Idler
Same as pulleys - teeth engage belt teeth side.

### Smooth Idler
| Bore | OD | Width |
|------|-------|-------|
| 3 mm | 12 mm | 8 mm |
| 5 mm | 20 mm | 10 mm |

Belt runs on **back** (smooth side) over smooth idlers.

## Belt Tension

- **Recommended**: 2-3 lbs force for proper tension
- **Test**: Belt should deflect ~5mm when pressed with 1 lb force over 100mm span

## OpenSCAD Modules

```openscad
// GT2 pulley (simplified - no actual tooth profile)
module gt2_pulley(teeth=20, width=7, bore=5) {
    pitch = 2;
    pd = teeth * pitch / PI;
    od = pd + 1.5;  // Approximate OD
    flange_d = od + 3;
    
    difference() {
        union() {
            // Toothed section
            cylinder(d=od, h=width, $fn=teeth*2);
            
            // Flanges
            cylinder(d=flange_d, h=1, $fn=48);
            translate([0, 0, width-1])
                cylinder(d=flange_d, h=1, $fn=48);
        }
        
        // Bore
        translate([0, 0, -0.1])
            cylinder(d=bore, h=width+0.2, $fn=24);
        
        // Set screw flat (optional)
        translate([bore/2 - 0.3, -3, width/2])
            cube([1, 6, 4], center=true);
    }
}

// Smooth idler
module smooth_idler(od=20, bore=5, width=10) {
    difference() {
        cylinder(d=od, h=width, $fn=48);
        translate([0, 0, -0.1])
            cylinder(d=bore, h=width+0.2, $fn=24);
    }
}

// Belt path visualization (2D)
module gt2_belt_path(points, width=1.5) {
    for (i = [0:len(points)-2]) {
        hull() {
            translate(points[i]) circle(d=width, $fn=16);
            translate(points[i+1]) circle(d=width, $fn=16);
        }
    }
}

// Belt length calculator
function gt2_belt_length(pulleys, centers) =
    // For 2 pulleys: L = 2C + π(D1+D2)/2 + (D2-D1)²/(4C)
    let(d1 = pulleys[0] * 2 / PI,
        d2 = pulleys[1] * 2 / PI,
        c = centers)
    2*c + PI*(d1+d2)/2 + pow(d2-d1, 2)/(4*c);
```

## GT2 Tooth Profile (for reference)

The actual GT2 tooth is a modified curvilinear profile:
- Tooth height: 0.75 mm
- Tooth width at base: ~1.0 mm
- Tooth angle: ~40°

For 3D printed pulleys, use existing `GT2_2mm_pulley.scad` libraries for accurate profiles.

## Design Tips

1. **Belt path**: Keep idlers on the smooth side when possible
2. **Tension adjustment**: Add slot for motor or idler adjustment (5-10mm travel)
3. **Printed pulleys**: Use 0.1mm layers, 100% infill, and PETG/ABS
4. **Flanges**: Essential to prevent belt walking - 1mm height minimum
