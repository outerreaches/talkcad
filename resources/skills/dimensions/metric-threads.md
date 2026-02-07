---
tags: [thread, screw, metric, m3, m4, m5, clearance, tap, hole, fastener, nut, trap]
---
# Metric Thread Reference

Complete reference for metric fasteners, clearance holes, and nut traps.

**For modeled threads:** Use `threads.scad` library - see `techniques/openscad-threads-scad.md` (use `use <threads.scad>;`)
**For imperial threads:** See `dimensions/units-and-thread-conversions.md`

## Thread Specifications

| Size | Major Ø | Pitch (coarse) | Pitch (fine) |
|------|---------|----------------|--------------|
| M2 | 2.0 mm | 0.40 mm | 0.25 mm |
| M2.5 | 2.5 mm | 0.45 mm | 0.35 mm |
| M3 | 3.0 mm | 0.50 mm | 0.35 mm |
| M4 | 4.0 mm | 0.70 mm | 0.50 mm |
| M5 | 5.0 mm | 0.80 mm | 0.50 mm |
| M6 | 6.0 mm | 1.00 mm | 0.75 mm |
| M8 | 8.0 mm | 1.25 mm | 1.00 mm |

## Drill/Tap Sizes

| Size | Tap Drill | Close Fit | Free Fit |
|------|-----------|-----------|----------|
| M2 | 1.6 mm | 2.2 mm | 2.4 mm |
| M2.5 | 2.05 mm | 2.7 mm | 2.9 mm |
| M3 | 2.5 mm | 3.2 mm | 3.4 mm |
| M4 | 3.3 mm | 4.3 mm | 4.5 mm |
| M5 | 4.2 mm | 5.3 mm | 5.5 mm |
| M6 | 5.0 mm | 6.4 mm | 6.6 mm |
| M8 | 6.8 mm | 8.4 mm | 9.0 mm |

## Socket Head Cap Screws (SHCS)

| Size | Head Ø | Head Height | Hex Key |
|------|--------|-------------|---------|
| M2 | 3.8 mm | 2.0 mm | 1.5 mm |
| M2.5 | 4.5 mm | 2.5 mm | 2.0 mm |
| M3 | 5.5 mm | 3.0 mm | 2.5 mm |
| M4 | 7.0 mm | 4.0 mm | 3.0 mm |
| M5 | 8.5 mm | 5.0 mm | 4.0 mm |
| M6 | 10.0 mm | 6.0 mm | 5.0 mm |
| M8 | 13.0 mm | 8.0 mm | 6.0 mm |

## Hex Nuts (ISO 4032)

| Size | Width A/F | Thickness | Trap Width (FDM) | Trap Depth |
|------|-----------|-----------|------------------|------------|
| M2 | 4.0 mm | 1.6 mm | 4.4 mm | 1.8 mm |
| M2.5 | 5.0 mm | 2.0 mm | 5.4 mm | 2.2 mm |
| M3 | 5.5 mm | 2.4 mm | 6.0 mm | 2.6 mm |
| M4 | 7.0 mm | 3.2 mm | 7.5 mm | 3.5 mm |
| M5 | 8.0 mm | 4.0 mm | 8.5 mm | 4.3 mm |
| M6 | 10.0 mm | 5.0 mm | 10.5 mm | 5.3 mm |
| M8 | 13.0 mm | 6.5 mm | 13.5 mm | 6.8 mm |

## Nut Trap Techniques

### Face-Load (Pull-Through)
Nut inserted from back; screw pulls it tighter into pocket. Best for feet/bottom mounting.

```openscad
module nut_trap_face(size="M3", depth=3) {
    dims = (size == "M3") ? [6.0, 3.4] :
           (size == "M4") ? [7.5, 4.5] :
           (size == "M5") ? [8.5, 5.5] : [6.0, 3.4];
    
    // Hexagonal pocket
    cylinder(d=dims[0] / cos(30), h=depth, $fn=6);
    // Through-hole for screw
    translate([0, 0, -10]) cylinder(d=dims[1], h=20, $fn=24);
}
```

### Side-Load (Captive Slot)
Nut slides in from side. Essential when hole axis is horizontal (no support needed).

```openscad
module nut_trap_slot(size="M3", slot_length=10) {
    dims = (size == "M3") ? [6.0, 2.6, 3.4] :
           (size == "M4") ? [7.5, 3.5, 4.5] : [6.0, 2.6, 3.4];
    w = dims[0];
    h = dims[1];
    clear = dims[2];
    
    // Nut slot (open for insertion)
    translate([-w/2, 0, -h/2])
        cube([w, slot_length, h]);
    // Screw hole (perpendicular)
    rotate([90, 0, 0])
        cylinder(d=clear, h=slot_length + 5, center=true, $fn=24);
}
```

## OpenSCAD Modules

```openscad
use <threads.scad>;  // For modeled threads

// Clearance hole
module clearance_hole(size="M3", depth=10, fit="free") {
    d = (size == "M2") ? (fit == "free" ? 2.4 : 2.2) :
        (size == "M2.5") ? (fit == "free" ? 2.9 : 2.7) :
        (size == "M3") ? (fit == "free" ? 3.4 : 3.2) :
        (size == "M4") ? (fit == "free" ? 4.5 : 4.3) :
        (size == "M5") ? (fit == "free" ? 5.5 : 5.3) :
        (size == "M6") ? (fit == "free" ? 6.6 : 6.4) : 3.4;
    
    cylinder(d=d, h=depth, $fn=24);
}

// Counterbore for socket head
module counterbore(size="M3", depth=10, head_depth=3.5) {
    dims = (size == "M3") ? [3.4, 6.0] :
           (size == "M4") ? [4.5, 7.5] :
           (size == "M5") ? [5.5, 9.0] : [3.4, 6.0];
    
    cylinder(d=dims[1], h=head_depth, $fn=24);  // Head recess
    cylinder(d=dims[0], h=depth, $fn=24);       // Shaft
}

// Screw boss with counterbore
module screw_boss(size="M3", height=10, od=8) {
    difference() {
        cylinder(d=od, h=height, $fn=24);
        translate([0, 0, -0.1])
            counterbore(size, height+0.2, 4);
    }
}

// For modeled threads, use threads.scad:
// ScrewThread(diameter, length, pitch=0, tolerance=0.4)
// ScrewHole(diameter, length, pitch=0, tolerance=0.4) { children(); }
```

## Design Tips

1. **Nut traps vs modeled threads**: Use nut traps for strength; modeled threads for custom sizes
2. **Tolerance**: Add 0.2-0.3mm to trap dimensions for FDM
3. **Captive nuts**: Side-load slots prevent nuts falling out during assembly
4. **Wall thickness**: Keep ≥2mm behind nut in load direction
5. **Print orientation**: Thread axis vertical for best strength

