---
tags: [drone, edf, jet, fan, motor, duct, ducted]
---
# Electric Ducted Fans (EDF)

Propulsion units for RC jets. Defined by rotor size, but we mount the **housing**. We must ensure nothing is protruding inside the housing except for the crush ribs.

## Common Housing Dimensions
*Warning: These vary by brand (FMS, Freewing, etc). Measure if possible. These are safe approximations.*

| Nominal Class | Rotor | Housing OD (Approx) | Housing Length |
|---------------|-------|---------------------|----------------|
| **30mm** | 30mm | 32.5 mm | ~25 mm |
| **50mm** | 50mm | 54.0 mm | ~35 mm |
| **64mm** | 64mm | 67.0 mm | ~45 mm |
| **70mm** | 70mm | 74.0 mm | ~55 mm |

## Design Rule: Do Not Squeeze
EDF housings are thin plastic. If you clamp them too hard or uniformly with a screw clamp, they ovalize, causing the rotor to scrape the walls (destroying the fan).

## Recommended Mounting: "Crush Ribs"
Instead of a perfect circle, print ribs that bite into the housing.

1.  **Holder ID**: Housing OD + 0.5mm (Clearance).
2.  **Ribs**: 3 or 4 longitudinal ribs inside the holder.
3.  **Rib Height**: Reduces ID to Housing OD - 0.5mm (Interference).
4.  **Result**: The ribs deform/crush, holding the fan tight without ovalizing the main shell.

```openscad
module edf_mount(housing_od=54, length=20) {
    holder_od = housing_od + 6;
    clearance_id = housing_od + 0.6;
    
    difference() {
        // Main Ring
        cylinder(d=holder_od, h=length);
        
        // Clearance Hole
        translate([0,0,-1]) cylinder(d=clearance_id, h=length+2);
    }
    
    // Crush Ribs (3x)
    for(i=[0:120:359]) rotate([0,0,i])
        translate([housing_od/2 - 0.2, -1, 0]) // Poke into the air gap
            cube([1.5, 2, length]);
}
```
