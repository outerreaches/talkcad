---
tags: [openscad, technique, rounded-cube, fillet, hull, minkowski, aesthetic]
---
# Rounded Cubes & Fillets

OpenSCAD does not have a built-in `rounded_cube` primitive, but there are several ways to achieve it.

## Method 1: Hull of Spheres/Cylinders (Fastest & Best)
This is the standard, performant way to make rounded boxes.

### 2D Rounded Rect (Extruded)
Most efficient for simple plates.
```openscad
module rounded_square(size, r) {
    w = size[0]; h = size[1];
    hull() {
        translate([r, r]) circle(r=r);
        translate([w-r, r]) circle(r=r);
        translate([w-r, h-r]) circle(r=r);
        translate([r, h-r]) circle(r=r);
    }
}
// Usage: linear_extrude(box_z) rounded_square([x, y], r);
```

### 3D Rounded Cube (Hull 4 Cylinders)
Rounds vertical edges only.
```openscad
module rounded_cube_vertical(size, r) {
    x = size[0]; y = size[1]; z = size[2];
    hull() {
        translate([r, r, 0]) cylinder(r=r, h=z);
        translate([x-r, r, 0]) cylinder(r=r, h=z);
        translate([x-r, y-r, 0]) cylinder(r=r, h=z);
        translate([r, y-r, 0]) cylinder(r=r, h=z);
    }
}
```

### Fully Rounded Cube (Hull 8 Spheres)
Rounds all edges. Slightly slower preview.
```openscad
module rounded_cube_all(size, r) {
    x = size[0]; y = size[1]; z = size[2];
    hull() {
        for (dx=[0,1]) for (dy=[0,1]) for (dz=[0,1])
            translate([r + dx*(x-2*r), r + dy*(y-2*r), r + dz*(z-2*r)])
                sphere(r=r);
    }
}
```

## Method 2: Minkowski (Slow - Avoid)
`minkowski()` is very computationally expensive.
```openscad
// AVOID unless necessary
minkowski() {
    cube([10, 10, 10]);
    sphere(r=1);
}
```
*Note: Minkowski adds the sphere radius to the cube dimensions, making sizing hard to predict.*

## Method 3: Library (Best for Production)
If utilizing a library like `BOSL2` or `MCAD` (if available), use their primitives:
- MCAD: `roundedBox(size, radius, sidesonly)`
