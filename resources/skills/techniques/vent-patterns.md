---
tags: [technique, vent, grill, grid, hex, honeycomb, airflow, cooling]
---
# Vent Patterns & Grids

Techniques for creating airflow vents without custom libraries.

## 1. Simple Linear Slots
The most reliable method. Easy to print if slots align with bridging direction.

```openscad
module vent_slots(size=[40, 40, 2], num_slots=5, gap_ratio=0.5) {
    width = size[0];
    height = size[1];
    thick = size[2];
    
    // Calculate slot geometry
    slot_w = (width * gap_ratio) / num_slots;
    solid_w = (width * (1-gap_ratio)) / (num_slots+1);
    
    difference() {
        cube(size);
        for(i=[0:num_slots-1]) {
            translate([solid_w + i*(slot_w+solid_w), 0, -1])
                cube([slot_w, height, thick+2]);
        }
    }
}
```

## 2. Honeycomb / Hex Grid
Efficient for material usage and strength.

```openscad
// Radius: size of hex
// Wall: thickness of walls between hexes
module hex_grid(bounds=[50, 50, 2], r=3, wall=1) {
    dx = r * sqrt(3) + wall;
    dy = r * 1.5 + wall * sqrt(3)/2; // Approximation for spacing
    
    cols = floor(bounds[0] / dx);
    rows = floor(bounds[1] / dy);
    
    difference() {
        cube(bounds);
        // Cutout hexes
        for(y=[0:rows]) for(x=[0:cols]) {
            // Offset odd rows
            x_offset = (y % 2 == 0) ? 0 : dx/2;
            translate([x*dx + x_offset + dx/2, y*dy + dy/2, -1])
                cylinder(r=r, h=bounds[2]+2, $fn=6);
        }
    }
}
```

## Design Rules for Vents
1.  **Bridging**: Keep slot widths under 10mm if not using supports.
2.  **First Layer**: If printing face-down, hex grids can be tricky (many small islands). Linear slots are safer.
3.  **Strength**: Keep walls at least 1.2mm (3 perimeters) for durability.
