---
tags: [box, enclosure, case, lid, joint, lip, groove, parametric]
---
# Box and Enclosure Patterns

Parametric patterns for designing printable enclosures.

## Lip-Groove Joint

The most common lid-to-body connection.

### Dimensions
| Parameter | Recommended |
|-----------|-------------|
| Lip width | 1.5-2.0 mm |
| Lip height | 2.0-3.0 mm |
| Groove clearance | 0.2-0.3 mm |
| Wall thickness | 2.0-3.0 mm |

### OpenSCAD Pattern

```openscad
// Box body with lip
module box_body(inner=[60, 40, 25], wall=2, lip=2) {
    outer = [inner[0] + wall*2, inner[1] + wall*2, inner[2] + wall];
    
    difference() {
        cube(outer);
        
        // Inner cavity
        translate([wall, wall, wall])
            cube(inner);
    }
    
    // Lip for lid
    translate([wall - lip/2, wall - lip/2, inner[2] + wall])
        difference() {
            cube([inner[0] + lip, inner[1] + lip, 2]);
            translate([lip, lip, -0.1])
                cube([inner[0] - lip, inner[1] - lip, 2.2]);
        }
}

// Matching lid with groove
module box_lid(inner=[60, 40, 5], wall=2, lip=2, clearance=0.25) {
    outer = [inner[0] + wall*2, inner[1] + wall*2, inner[2] + wall];
    groove = lip + clearance*2;
    
    difference() {
        cube(outer);
        
        // Groove to fit over lip
        translate([wall - groove/2, wall - groove/2, -0.1])
            difference() {
                cube([inner[0] + groove, inner[1] + groove, 2.5]);
                translate([groove, groove, -0.1])
                    cube([inner[0] - groove, inner[1] - groove, 2.7]);
            }
    }
}
```

## Screw Boss Corners

For secure, removable lids.

```openscad
module corner_boss(h=10, screw="M3") {
    boss_d = (screw == "M3") ? 8 : 6;
    hole_d = (screw == "M3") ? 2.5 : 2.0;
    
    difference() {
        cylinder(d=boss_d, h=h, $fn=24);
        cylinder(d=hole_d, h=h+0.1, $fn=16);
    }
}

module box_with_corners(inner=[60, 40, 25], wall=2) {
    difference() {
        union() {
            // Main box
            cube([inner[0] + wall*2, inner[1] + wall*2, inner[2] + wall]);
            
            // Corner bosses
            for (x = [wall + 4, inner[0] + wall - 4]) {
                for (y = [wall + 4, inner[1] + wall - 4]) {
                    translate([x, y, wall])
                        corner_boss(inner[2]);
                }
            }
        }
        
        // Inner cavity
        translate([wall, wall, wall])
            cube([inner[0], inner[1], inner[2] + 1]);
    }
}
```

## Snap-Fit Lid

For tool-less assembly.

```openscad
module snap_box_body(inner=[60, 40, 25], wall=2) {
    outer = [inner[0] + wall*2, inner[1] + wall*2, inner[2] + wall];
    
    difference() {
        cube(outer);
        translate([wall, wall, wall])
            cube(inner);
    }
    
    // Snap hooks on short sides
    for (y = [0, inner[1] + wall*2]) {
        translate([outer[0]/2, y, inner[2] - 5])
            rotate([y > 0 ? 0 : 180, 0, 0])
                snap_hook();
    }
}

module snap_hook() {
    // Simple cantilever snap
    translate([-3, 0, 0]) {
        cube([6, 2, 8]);
        translate([0, 2, 7])
            cube([6, 1.5, 1.5]);
    }
}
```

## Sliding Lid

For quick access containers.

```openscad
module sliding_lid_box(inner=[60, 40, 20], wall=2, track=1.5) {
    outer = [inner[0] + wall*2, inner[1] + wall*2 + track*2, inner[2] + wall];
    
    difference() {
        cube(outer);
        
        // Inner cavity
        translate([wall, wall + track, wall])
            cube(inner);
        
        // Lid tracks
        for (y = [wall, inner[1] + wall + track]) {
            translate([-1, y, inner[2] - 1])
                cube([outer[0] + 2, track, 2]);
        }
        
        // Open top
        translate([wall, wall + track, inner[2] + wall - 1])
            cube([inner[0], inner[1], 2]);
    }
}

module sliding_lid(inner=[60, 40], wall=2, track=1.5, thick=2) {
    clearance = 0.2;
    w = inner[1] + track*2 - clearance*2;
    l = inner[0] + wall*2 + 5;  // Extra for grip
    
    cube([l, w, thick]);
    
    // Finger grip
    translate([l - 5, w/2, thick])
        cylinder(d=10, h=3, $fn=24);
}
```

## Design Guidelines

| Feature | Recommendation |
|---------|----------------|
| Min wall | 1.5 mm (PLA), 2.0 mm (PETG) |
| Screw boss wall | 2× screw OD minimum |
| Lid overlap | 2-3 mm for sealing |
| Vent holes | 2-3 mm diameter |
| Cable entry | Add strain relief |
