---
tags: [fastener, insert, threaded, heat-set, m3, m4]
---
# Heat-Set Inserts

Brass threaded inserts pressed into plastic using a soldering iron. Superior to printing threads or self-tapping screws.

## Why use them?
- **Reusability**: Can screw/unscrew hundreds of times (unlike self-tappers).
- **Strength**: High pull-out resistance.
- **Reliability**: Metal-on-metal thread interface.

## Standard Dimensions (CNCKitchen / Generic)
*Check your specific insert datasheet, but these are safe defaults.*

| Size | Hole Diameter (CAD) | Hole Depth | Insert Length |
|------|--------------------|------------|---------------|
| **M3** | 4.0 mm - 4.1 mm | 6.0 mm | 5.7 mm (Standard) |
| **M3 (Short)** | 4.0 mm | 4.0 mm | 3.0 mm |
| **M4** | 5.6 mm | 8.5 mm | 8.1 mm |
| **M5** | 7.0 mm | 10.0 mm | 9.5 mm |

## Design Guidelines

### 1. The Hole (Boss)
- **Diameter**: Use the table values above as starting points. These are empirically tuned for common inserts.
    - *Note*: Insert OD varies by manufacturer (typically 4.6-5.0mm for M3). The table hole sizes already account for this.
    - Fine-tune: If insert sinks too easily, reduce hole by 0.1mm. If it won't seat, increase by 0.1mm.
- **Wall Thickness**: The plastic surrounding the insert (boss) is critical.
    - *Minimum wall*: 1.5mm - 2.0mm around the hole.
    - Example M3 boss: Hole 4.1mm + (2 x 1.6mm walls) = 7.3mm Outer Diameter.

### 2. Chamfers help alignment
Always add a small chamfer to the top of the hole to help center the insert before pressing.
- `cylinder(r1=hole_r, r2=hole_r + 0.5, h=0.5)`

### 3. OpenSCAD Pattern
```openscad
module m3_insert_boss(height=8) {
    hole_d = 4.1;  // Tweak for your printer
    boss_d = 8.0;
    
    difference() {
        cylinder(d=boss_d, h=height);
        
        union() {
            // Main hole
            translate([0,0, -0.1]) cylinder(d=hole_d, h=height+0.2);
            // Chamfer for alignment
            translate([0,0, height-0.5]) cylinder(r1=hole_d/2, r2=hole_d/2 + 0.4, h=0.51);
        }
    }
}
```
