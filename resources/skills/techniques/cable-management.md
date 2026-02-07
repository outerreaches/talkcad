---
tags: [cable, wire, strain-relief, zip-tie, anchor, management, routing]
---
# Cable Management Techniques

How to route, secure, and protect wires in printed parts.

## 1. Zip Tie Anchors
The standard way to secure a wire bundle.
- **Micro Zip Tie**: 2.5mm width usually.
- **Design**: A small "tunnel" or "bridge" in the floor of the case.

```openscad
// A small bridge to slide a zip tie under
module zip_tie_anchor(width=4, height=3) {
    difference() {
        // The lump
        hull() {
             translate([-4, 0, 0]) cylinder(r=1, h=width, center=true);
             translate([4, 0, 0]) cylinder(r=1, h=width, center=true);
             translate([0, 2, 0]) cylinder(r=1, h=width, center=true);
        }
        // The tunnel (curved to help insertion)
        rotate([0, 90, 0]) cylinder(d=height, h=10, center=true);
    }
}
```

## 2. Strain Relief (The "Tortuous Path")
To prevent pulling on solder joints, force the cable to weave through 3 posts. Friction holds it.
- **Gap**: Cable Diameter + 0.2mm.
- **Pattern**: Post -> Gap -> Post -> Gap -> Post.

```openscad
module strain_relief_posts(cable_d=3) {
    clearance = 0.5;
    spacing = cable_d + 4;
    
    // 3 Posts in a triangle or zig-zag
    cylinder(d=4, h=8);
    translate([spacing, 0, 0]) cylinder(d=4, h=8);
    translate([spacing/2, -spacing*0.8, 0]) cylinder(d=4, h=8);
}
```

## 3. Exit Glands
When a wire leaves the box:
- **Round Exit**: Use a "Grommet" shape (filleted edges) to avoid cutting insulation.
- **Clam Shell**: If the plug is big, split the hole between the Lid and the Box.
