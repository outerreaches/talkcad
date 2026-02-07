---
tags: [techniques, openscad, threads, fasteners, library, threads-scad]
---
# OpenSCAD `threads.scad` (CC0) – Usage Notes

TalkCAD bundles the **`threads.scad`** library (CC0) for common threads and fasteners.

Upstream reference: `https://github.com/rcolyer/threads-scad`

**Note:** This library is metric-focused. There is no `EnglishThread` function. For imperial/inch threads (UNC, UNF, UNEF), convert to metric and use `ScrewThread` with explicit pitch. See "Imperial Thread Example" below.

## Include pattern

At the top of your file:

```openscad
use <threads.scad>;
```

## CRITICAL: ScrewHole/ClearanceHole Usage Pattern

**These modules WRAP their children - they are NOT standalone shapes you subtract!**

### WRONG (common mistake):
```openscad
difference() {
    my_cap();
    ScrewHole(28, 12);  // Does nothing! ScrewHole needs children.
}
```

### CORRECT (two options):

```openscad
// Option 1: Use ScrewHole wrapper (recommended)
ScrewHole(28, 12, [0,0,0], [0,0,0], pitch=2.7, tooth_angle=30, tolerance=0.4) {
    cylinder(d=32, h=14);  // The cap - threads are subtracted from it
}

// Option 2: Use difference() with ScrewThread directly
difference() {
    cylinder(d=32, h=14);
    translate([0, 0, -0.01])
        ScrewThread(28 * 1.01 + 0.5, 12.02, pitch=2.7, tolerance=0.4);
}
```

## Module Reference

### External Threads (standalone solid shape)

- `ScrewThread(outer_diam, height, pitch=0, tooth_angle=30, tolerance=0.4)`
  - Creates a solid rod with external threads at origin
  - If `pitch=0`, uses metric standard pitch for the diameter
  - Use in `union()` to add threads, or in `difference()` to cut matching internal threads

### Internal Threads (wrapper module)

- `ScrewHole(outer_diam, height, position=[0,0,0], rotation=[0,0,0], pitch=0, tooth_angle=30, tolerance=0.4) { children(); }`
  - Subtracts internal threads from its children
  - The children are the solid body you want to add threads to

### Clearance Holes (wrapper modules)

- `ClearanceHole(diameter, height, position=[0,0,0], rotation=[0,0,0], tolerance=0.4) { children(); }`
- `RecessedClearanceHole(...) { children(); }`
- `CountersunkClearanceHole(...) { children(); }`

### Common Hardware (standalone solid shapes)

- `MetricBolt(diameter, length, tolerance=0.4)` - hex head bolt with threads
- `MetricNut(diameter, thickness=0, tolerance=0.4)` - hex nut with internal threads
- `MetricWasher(diameter)` - flat washer

### Specialty Modules

- `PhillipsTip(width=7, thickness=0, straightdepth=0)`
  - **Wrapper**: Subtracts a Phillips driver slot from children.
  - Useful for making custom screw heads or tool interfaces.

- `AugerThread(outer_diam, inner_diam, height, pitch, tooth_angle=30)`
  - Large, coarse, deep threads (like a wood screw or dirt auger).
  - Better for FDM-printed screws than fine machine threads.
  - Companion: `AugerHole(...)` wrapper.

- `RodStart(diameter, height) / RodEnd(diameter, height)`
  - Creates modular connecting rods (Male/Female ends).
  - `RodStart`: External thread on top.
  - `RodEnd`: Internal thread on bottom (flips for printing).
  - Perfect for splitting tall objects into screw-together segments.

## Practical Tips

- For bottle caps: use `ScrewHole` wrapper or subtract `ScrewThread` from the inner surface
- For bolts/screws: use `ScrewThread` at the end of a shaft
- Set tolerance to 0.3-0.5mm for FDM printing
- Keep `$fn` at 64-128 for clean threads (higher = slower render)

## Imperial Thread Example

For imperial threads (e.g., 1/2"-28 UNEF), convert to metric:
- **Pitch (mm)** = 25.4 / TPI
- **Major diameter (mm)** = inches × 25.4

```openscad
use <threads.scad>;

// 1/2"-28 UNEF external thread (e.g., for a muzzle thread adapter)
major_d = 0.5 * 25.4;        // 12.7mm
pitch = 25.4 / 28;           // 0.907mm
thread_length = 15;

ScrewThread(major_d, thread_length, pitch=pitch, tolerance=0.4);

// 5/8"-24 UNEF internal thread
major_d_58 = 0.625 * 25.4;   // 15.875mm
pitch_58 = 25.4 / 24;        // 1.058mm

ScrewHole(major_d_58, 12, pitch=pitch_58, tolerance=0.4) {
    cylinder(d=22, h=12);    // Body with internal threads
}
```

See also: `dimensions/units-and-thread-conversions.md` for TPI↔pitch tables.
