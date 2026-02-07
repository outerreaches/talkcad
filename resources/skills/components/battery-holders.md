---
tags: [battery, aa, aaa, 18650, cr2032, holder, power, electronics]
---
# Battery Holders

Dimensions for common battery sizes and holder designs.

## Battery Dimensions

| Battery | Diameter | Length | Voltage |
|---------|----------|--------|---------|
| AA | 14.5 mm | 50.5 mm | 1.5V |
| AAA | 10.5 mm | 44.5 mm | 1.5V |
| 18650 | 18.6 mm | 65.2 mm | 3.7V |
| CR2032 | 20.0 mm | 3.2 mm | 3.0V |
| 9V | 26.5 × 17.5 mm | 48.5 mm | 9V |

## Holder Clearances (FDM)

| Battery | Pocket Diameter | Pocket Length |
|---------|-----------------|---------------|
| AA | 15.0-15.2 mm | 51.0 mm |
| AAA | 11.0-11.2 mm | 45.0 mm |
| 18650 | 19.0-19.2 mm | 66.0 mm |
| CR2032 | 20.5 mm | 3.5 mm |

## Contact Springs

- **Negative end**: Coil spring, adds 2-3mm compression
- **Positive end**: Flat contact or bent tab
- **Spring travel**: Design for 2-4mm compression

## OpenSCAD Modules

```openscad
// AA battery holder slot
module aa_battery_slot(wall=2) {
    d = 15.0;  // With clearance
    l = 51.0;
    spring_extra = 3;
    
    difference() {
        // Outer shell
        cube([l + spring_extra + wall*2, d + wall*2, d/2 + wall]);
        
        // Battery pocket
        translate([wall, wall + d/2, d/2 + wall])
            rotate([0, 90, 0])
                cylinder(d=d, h=l + spring_extra, $fn=32);
        
        // Open top for insertion
        translate([wall, wall, d/2 + wall - 0.1])
            cube([l + spring_extra, d, d/2 + 1]);
    }
}

// CR2032 coin cell holder
module cr2032_holder(wall=1.5) {
    d = 20.5;
    h = 3.5;
    
    difference() {
        cylinder(d=d + wall*2, h=h + wall, $fn=48);
        translate([0, 0, wall])
            cylinder(d=d, h=h + 0.1, $fn=48);
        
        // Slot for removal
        translate([-2, -d/2 - wall - 1, wall])
            cube([4, d + wall*2 + 2, h + 1]);
    }
}

// 18650 holder with spring contacts
module battery_18650_holder() {
    d = 19.0;
    l = 66.0;
    spring = 4;
    wall = 2;
    
    difference() {
        cube([l + spring + wall*2, d + wall*2, d*0.6 + wall]);
        
        // Battery channel
        translate([wall, wall + d/2, d*0.6 + wall])
            rotate([0, 90, 0])
                cylinder(d=d, h=l + spring, $fn=32);
    }
}
```

## Design Tips

1. **Retention**: Add small lips or tabs to prevent batteries falling out
2. **Polarity markings**: Emboss + and - symbols
3. **Vent holes**: For easy battery removal with finger push
4. **Contact clearance**: Leave room for solder joints on contacts
