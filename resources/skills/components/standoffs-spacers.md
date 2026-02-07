---
tags: [standoff, spacer, pcb, mounting, m2, m3, electronics, enclosure]
---
# PCB Standoffs and Spacers

Standard dimensions for mounting PCBs and electronics.

## Common Standoff Sizes

| Screw | OD (Hex) | OD (Round) | Tap Hole |
|-------|----------|------------|----------|
| M2 | 4.0 mm | 4.0 mm | 1.6 mm |
| M2.5 | 5.0 mm | 5.0 mm | 2.05 mm |
| M3 | 5.5 mm | 6.0 mm | 2.5 mm |
| M4 | 7.0 mm | 8.0 mm | 3.3 mm |

## Standard Heights

Common standoff heights: 3, 5, 6, 8, 10, 12, 15, 20, 25, 30 mm

## PCB Clearance Guidelines

| Component Type | Min Standoff Height |
|----------------|---------------------|
| SMD only (bottom clear) | 3 mm |
| Through-hole leads | 5 mm |
| Tall capacitors | 8-10 mm |
| Headers/connectors | 10-15 mm |

## Printed Standoff Design

### Press-fit (no screws)
- Post diameter = PCB hole - 0.1 to 0.2 mm
- Common PCB holes: 3.2 mm (M3), 2.7 mm (M2.5)

### Screw-through
- Clearance hole in standoff for screw to pass through
- Nut or boss at bottom

## OpenSCAD Modules

```openscad
// Simple PCB standoff (screw from top)
module pcb_standoff(h=10, screw="M3") {
    dims = (screw == "M2") ? [4, 1.6] :
           (screw == "M2.5") ? [5, 2.05] :
           (screw == "M3") ? [6, 2.5] : [8, 3.3];
    od = dims[0];
    tap = dims[1];
    
    difference() {
        cylinder(d=od, h=h, $fn=24);
        cylinder(d=tap, h=h+0.1, $fn=16);
    }
}

// Hex standoff (matches metal ones)
module hex_standoff(h=10, af=5.5, tap_d=2.5) {
    // af = across flats (wrench size)
    difference() {
        cylinder(d=af / cos(30), h=h, $fn=6);
        cylinder(d=tap_d, h=h+0.1, $fn=16);
    }
}

// Snap-in standoff (no screw needed)
module snap_standoff(h=8, pcb_hole=3.2) {
    post_d = pcb_hole - 0.15;
    base_d = 7;
    
    // Base
    cylinder(d=base_d, h=2, $fn=24);
    
    // Post with snap head
    translate([0, 0, 2]) {
        cylinder(d=post_d, h=h-2, $fn=16);
        translate([0, 0, h-2])
            cylinder(d1=post_d, d2=post_d+1, h=0.8, $fn=16);
    }
}

// Recessed screw boss (screw from bottom)
module screw_boss(h=8, screw="M3", head_recess=3) {
    dims = (screw == "M3") ? [6, 3.2, 5.5] : [5, 2.7, 4.5];
    od = dims[0];
    clear = dims[1];
    head_d = dims[2];
    
    difference() {
        cylinder(d=od + 3, h=h, $fn=24);
        // Clearance hole
        cylinder(d=clear, h=h+0.1, $fn=16);
        // Head recess
        cylinder(d=head_d, h=head_recess, $fn=24);
    }
}

// PCB mounting pattern generator
module pcb_standoffs(positions, h=10, screw="M3") {
    for (pos = positions) {
        translate([pos[0], pos[1], 0])
            pcb_standoff(h, screw);
    }
}
```

## Common PCB Patterns

| Board | Pattern | Holes |
|-------|---------|-------|
| Arduino Uno | 66 × 52 mm | M3 |
| Raspberry Pi | 58 × 49 mm | M2.5 |
| ESP32 DevKit | 48 × 23 mm | M2 or none |

## Design Tips

1. **Draft angle**: Add 1-2° taper for easy print release
2. **Chamfer tops**: Helps PCB alignment during assembly
3. **Ventilation**: Leave gaps between standoffs for airflow
4. **Wire routing**: Design channels between standoff positions
