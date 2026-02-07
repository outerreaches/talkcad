---
tags: [drone, fpv, camera, caddx, runcam, dji]
---
# FPV Cameras

Standard widths for FPV cameras (Analog and Digital).

## Sizes
*Only the width between mounting screws matters.*

1.  **Full Size (Legacy)**: 28mm width. (Rare now).
2.  **Mini (Legacy)**: 21mm width.
3.  **Micro (Standard)**: 19mm width. Most common for digital (DJI O3, Vista, Walksnail).
4.  **Nano**: 14mm width. Used in tiny whoops.

## Mounting
- **Screws**: Usually M2.
- **Thread Depth**: Very short (2-3mm). do NOT use long screws or you will crush the sensor.
- **Axis**: Cameras tilt up/down. Mounts usually clamping pivoting side plates.

## OpenSCAD Pattern (Side Plates)

```openscad
module camera_mount_plates(width=19) {
    plate_thick = 2;
    
    // Left Plate
    translate([-width/2 - plate_thick, 0, 0])
        difference() {
            cube([plate_thick, 10, 10], center=true);
            rotate([0,90,0]) cylinder(d=2.2, h=10); // Screw hole
        }

    // Right Plate
    translate([width/2, 0, 0])
        difference() {
            cube([plate_thick, 10, 10], center=true);
             rotate([0,90,0]) cylinder(d=2.2, h=10);
        }
}
```
