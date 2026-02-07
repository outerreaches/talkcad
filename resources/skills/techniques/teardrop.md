---
tags: [technique, teardrop, overhang, printing, fdm, horizontal-hole]
---
# Teardrop Holes (Printable Horizontal Holes)

A standard cylinder printed horizontally has a 90° overhang at the top, which droops on FDM printers.
A **teardrop** shape keeps all overhangs at 45°, making it perfectly printable without supports.

## The Module

```openscad
// r: radius of the hole
// h: length of the hole
// ang: max overhang angle (default 45 degrees, safe for most printers)
module teardrop(r=5, h=10, ang=45) {
    render() // Optional: Cache geometry if used often
    linear_extrude(h)
    polygon(points=concat(
        // Bottom half (semi-circle)
        [for(a=[180 + ang : 5 : 360 - ang]) [r*cos(a), r*sin(a)]],
        // Top tip (triangle)
        [[0, r / sin(ang)]]
    ));
}

// 3D Rotated Wrapper (Aligned for X/Y printing)
// Use this for cutting holes in walls
module teardrop_cutout(r=3, h=20) {
    rotate([0, 90, 0]) // Orient along X-axis
    teardrop(r=r, h=h);
}
```

## When to use
- **Horizontal mounting holes** (e.g., screw holes in the side of a box).
- **Shaft pass-throughs** printed on their side.
- **Micro-USB / Type-C cutouts** if simple shapes are needed.

## Math Explanation
The tip height calculates as `r / sin(angle)`.
- At 45°: Tip height ≈ `1.414 * r`.
- This means the hole is taller than it is wide. Ensure you have vertical clearance!
