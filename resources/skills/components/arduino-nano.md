---
tags: [arduino, nano, electronics, microcontroller, pcb, mounting]
---
# Arduino Nano

Small, breadboard-friendly microcontroller.

## Dimensions
- **PCB Size**: 45 mm × 18 mm (Approx, check specific clone)
- **Mounting Holes**: 4x holes (diameter 1.7mm - implies M1.6 screw or melt-pin).
- **Hole Spacing**: 40.6 mm × 15.2 mm.

## Design Tips
1.  **No Screws**: The holes are too small for standard M2/M3 screws.
2.  **Slide-In Rail**: The best way to mount a Nano is a "slide-in" U-channel.
3.  **USB Clearance**: The Mini-B/USB-C port overhangs the edge by ~1-2mm.

## OpenSCAD Module (Slide Mount)

```openscad
module nano_mount() {
    width = 18.5; // 18 + clearance
    length = 45;
    
    difference() {
        // C-channel body
        cube([width + 4, length, 8]);
        
        // The slot
        translate([2, 0, 2])
            cube([width, length+1, 10]);
            
        // PCB Rail grooves
        translate([2, 0, 3.6]) // PCB sits here
            cube([width, length+1, 2]);
    }
}
```
