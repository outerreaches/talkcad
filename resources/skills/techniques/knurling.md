---
tags: [technique, knurl, texture, grip, surface, handle]
---
# Knurling (Diamond Texture)

Adding grip to knobs and handles. This can be computationally expensive (high polygon count), so use sparingly or with low `$fn`.

## The Subtractive Method (Fastest)
Ideally, cut V-grooves out of a cylinder rather than adding diamonds. It produces a cleaner mesh.

```openscad
module knurled_cylinder(h=10, r=10, knurl_depth=0.5, count=24) {
    difference() {
        cylinder(h=h, r=r);
        
        // Cut grooves in two directions
        for(dir = [1, -1]) {
            for(i=[0:count-1]) {
                rotate([0, 0, i * (360/count)])
                linear_extrude(h, twist = dir * 45 * (h/r/2)) // Twist angle approximation
                    translate([r, 0])
                    circle(r=knurl_depth, $fn=3); // V-cutter
            }
        }
    }
}

// Example: A knob
module demo_knob() {
    knurled_cylinder(h=15, r=12, knurl_depth=0.8, count=30);
}
```

## Performance Warning
Knurling generates $2 \times count \times segments$ polygons.
- Keep `count` reasonable (20-40).
- Keep `$fn` low for the cylinder and cuts.
- Only apply to the outer surface module.

## FDM Considerations
- **Layer Height**: Standard 0.2mm layers resolve knurling well.
- **Overhangs**: The 45° twist is perfectly self-supporting.
- **Seam**: Randomizing Z-seam helps hide artifacts on knurled surfaces.
