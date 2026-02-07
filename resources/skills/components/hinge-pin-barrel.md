---
tags: [hinge, pin, barrel, knuckle, door, lid, joint, rotation]
---
# Pin and Barrel Hinges

Mechanical hinge designs for 3D printed assemblies.

## Pin Hinge (Separate Parts)

The classic hinge: two knuckle halves connected by a pin.

### Typical Dimensions

| Pin Diameter | Knuckle OD | Knuckle Width | Clearance |
|--------------|------------|---------------|-----------|
| 2 mm | 5 mm | 4 mm | 0.2 mm |
| 3 mm | 7 mm | 5 mm | 0.2-0.3 mm |
| 4 mm | 9 mm | 6 mm | 0.3 mm |
| 5 mm | 11 mm | 7 mm | 0.3 mm |

### Pin Materials
- **Metal**: 3mm rod, nails, or filament
- **Printed**: Slightly undersized (0.1-0.2mm)

## Barrel Hinge (Concealed)

Cylindrical hinge hidden inside the joint.

| Hinge Size | Barrel Ø | Barrel Length | Mortise Depth |
|------------|----------|---------------|---------------|
| Small | 8 mm | 25 mm | 13 mm |
| Medium | 10 mm | 35 mm | 18 mm |
| Large | 12 mm | 50 mm | 26 mm |

## OpenSCAD Modules

```openscad
// Pin hinge half (2 knuckles)
module hinge_half(od=7, id=3.2, knuckle_w=5, count=2, gap=0.2) {
    total_w = count * (knuckle_w + gap);
    
    for (i = [0:count-1]) {
        translate([0, 0, i * (knuckle_w*2 + gap*2)])
            hinge_knuckle(od, id, knuckle_w);
    }
}

// Single knuckle
module hinge_knuckle(od=7, id=3.2, width=5) {
    difference() {
        union() {
            // Barrel
            rotate([0, 90, 0])
                cylinder(d=od, h=width, $fn=24);
            // Leaf
            translate([0, 0, 0])
                cube([width, od/2, od]);
        }
        // Pin hole
        rotate([0, 90, 0])
            translate([0, 0, -0.5])
                cylinder(d=id, h=width+1, $fn=16);
    }
}

// Hinge pin
module hinge_pin(d=3, length=30) {
    cylinder(d=d, h=length, $fn=16);
    // Head
    cylinder(d=d+2, h=1.5, $fn=16);
}

// Complete hinge assembly (for visualization)
module hinge_assembly(od=7, pin_d=3, width=5, knuckles=3) {
    gap = 0.3;
    knuckle_w = width;
    total = knuckles * (knuckle_w + gap);
    
    // Left half (odd knuckles)
    color("SteelBlue")
    for (i = [0:2:knuckles-1]) {
        translate([0, 0, i * (knuckle_w + gap)])
            hinge_knuckle(od, pin_d + 0.3, knuckle_w);
    }
    
    // Right half (even knuckles)
    color("Coral")
    for (i = [1:2:knuckles-1]) {
        translate([0, 0, i * (knuckle_w + gap)])
            mirror([1, 0, 0])
                hinge_knuckle(od, pin_d + 0.3, knuckle_w);
    }
    
    // Pin
    color("Silver")
    rotate([0, 90, 0])
        translate([-(total-gap)/2, 0, 0])
            cylinder(d=pin_d, h=total, $fn=16);
}

// Barrel hinge pocket
module barrel_hinge_pocket(d=10, depth=18) {
    cylinder(d=d + 0.3, h=depth, $fn=32);
}

// Simple friction hinge (printed-in-place)
module friction_hinge_knuckle(od=8, axle_d=4, width=6, clearance=0.3) {
    difference() {
        cylinder(d=od, h=width, $fn=24);
        translate([0, 0, -0.1])
            cylinder(d=axle_d + clearance, h=width + 0.2, $fn=16);
    }
}
```

## Print-in-Place Alternative

For hinges that print assembled, see `print-in-place-hinge.md` in techniques.

## Design Guidelines

| Consideration | Recommendation |
|---------------|----------------|
| Knuckle count | Odd number (3 or 5) for balance |
| Pin clearance | 0.2-0.3 mm diameter |
| Knuckle gap | 0.3-0.5 mm between halves |
| Leaf thickness | ≥2 mm for strength |
| Print orientation | Barrel axis vertical |

## Tips

1. **Brass rod**: 3mm brass rod is cheap, strong, and smooth
2. **Chamfer ends**: Helps pin insertion
3. **Retention**: Add slight interference or end caps to keep pin in
4. **Lubrication**: Graphite or PTFE for smoother operation
