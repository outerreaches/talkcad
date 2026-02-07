---
tags: [lanyard, keychain, loop, hole, anchor, wearable]
---
# Lanyard & Keyring Holes

Secure points for attaching strings, paracord, or split-rings.

## Standard Sizes
1.  **Phone Charm string**: 1.5mm - 2mm hole.
    - Too small for printable features. Just a hole.
2.  **Paracord (550)**: 4mm - 5mm hole.
3.  **Split Ring (Keyring)**: 3mm+ hole, but the *wall* must be thin (<3mm) so the ring can spiral on.

## Designs

### 1. The Corner Bar (Strongest)
Cutting a tunnel through the corner of a solid block.
```openscad
module lanyard_corner_cut() {
    // Subtract this from a solid corner
    rotate([45, 0, 0])
        cylinder(d=4, h=20, center=true);
}
```

### 2. The External Loop
Adding a dedicated tab.
```openscad
module lanyard_tab(h=4) {
    d_out = 8;
    d_in = 4;
    difference() {
        hull() {
            cylinder(d=d_out, h=h);
            translate([-d_out/2, -d_out/2, 0]) cube([d_out, d_out/2, h]);
        }
        translate([0,0,-1]) cylinder(d=d_in, h=h+2);
    }
}
```

## Design Rules
1.  **Chamfer the Edges**: Paracord will chafe and cut on sharp printed edges. Always chamfer/fillet the entry and exit holes.
2.  **Wall Thickness**: Keep at least 2mm of plastic around the hole for load bearing.
3.  **Split Rings**: If designing for a metal keyring, ensure the "loop" is **D-shaped** or thin on one side. A thick round donut is hard to thread a stiff keyring onto.
