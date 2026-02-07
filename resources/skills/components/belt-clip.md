---
tags: [clip, belt, holster, wearable]
---
# Belt Clips

Attaching devices to a waistband or belt.

## Printable Design: The U-Clip
A standard injection-molded clip will fail in PLA if printed upright (Z-layers snap).
**Rule**: Print belt clips **lying on their side** so the extrusion lines run the length of the clip.

## Dimensions
- **Belt Width**: 40mm - 45mm (Standard leather belt).
- **Belt Thickness**: ~4mm.
- **Clip Gap**: 3mm (Pinch point) to 5mm (clearance).
- **Clip Thickness**: 3mm - 4mm (Stiff but flexible).

## Geometric Features
1.  **Lead-in Ramp**: Angled tip to help slide over the belt.
2.  **The "Barb"**: A bump on the inside face to latch under the belt.
3.  **Stress Relief**: A circular radius at the root (where it connects to the body) to prevent tearing.

## OpenSCAD Module (Side-Printable Profile)

```openscad
module belt_clip_profile(width=15, length=50) {
    thickness = 3.5;
    gap = 4;
    
    linear_extrude(width)
    difference() {
        // The main bulk
        union() {
             // Root block
             translate([0,0]) square([10, length]);
             // The Hook arm (Manual path)
             polygon([
                [0, length], 
                [gap+thickness*2, length], 
                [gap+thickness*2, 0], 
                [gap+thickness, 4], // Ramp tip
                [gap+thickness, length-thickness], // Inner top
                [thickness, length-thickness], // Inner root
                [thickness, 0]
             ]);
        }
        // Stress relief hole at the root
        translate([thickness, length-thickness - 1]) circle(r=1);
    }
}
```

## Material
- **PETG/ABS**: Recommended.
- **PLA**: Will lose tension (creep) if left clipped to a thick belt for days.
