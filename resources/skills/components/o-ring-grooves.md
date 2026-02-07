---
tags: [o-ring, seal, waterproof, gland, groove, ip67, gasket]
---
# O-Ring Grooves (Static Axial Seal)

Designing grooves for waterproofing enclosures.
*Note: We assume a "Face Seal" (Lid presses down on Box).*

## Squeeze (Compression)
For a static water seal, you typically want **20% - 30% compression**.
- **Compression**: The O-ring is squished flat to fill the gaps.

## Groove Dimensions (Parker Handbook Standards)
*Based on standard O-Ring Cross-Sections (CS).*

| O-Ring CS | Groove Depth (A) | Groove Width (B) | Target Squeeze |
|-----------|------------------|------------------|----------------|
| **1.78 mm** | 1.30 mm | 2.4 mm | ~25% |
| **2.62 mm** | 2.00 mm | 3.6 mm | ~23% |
| **3.53 mm** | 2.70 mm | 4.8 mm | ~22% |

## Design Pattern
1.  **Depth**: Controls the squeeze using the lid.
2.  **Width**: Must be **wider** than the O-ring (~1.3x) to allow it to expand sideways when crushed. If the groove is too narrow, the Lid won't close.
3.  **Draft**: Vertical walls are fine for FDM, but a slight taper helps cleaning.

## OpenSCAD Module (Face Seal)

```openscad
// Subtract this from the top face of your box wall
// Path: A 2D path (square/circle) defining the groove center
// Example for a circular box:
module o_ring_groove_circular(radius=20, cs=2) {
    depth = cs * 0.75; // 25% squeeze
    width = cs * 1.35; // Expansion room
    
    difference() {
        children(); // The Wall
        
        translate([0,0, -0.01]) // Cut from top
            rotate_extrude()
            translate([radius, 0, 0])
            square([width, depth*2], center=true); // Cut deep
    }
}
```

## FDM Printing Note
- **Seams**: The Z-seam can create a leak path across the groove.
- **Fix**: Use "Random Seam" or align seam *away* from the groove. Or use a slightly softer TPU gasket instead of a hard O-ring.
