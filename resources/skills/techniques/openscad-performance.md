# OpenSCAD Performance & Quality Knobs

This skill is about generating OpenSCAD that **renders fast** while still being printable.

## Core ideas

- **Resolution is the #1 performance lever.**
  - Avoid globally setting very high `$fn` unless absolutely necessary.
  - Prefer `$fa` / `$fs` (angular + fragment size) for more consistent quality.

- **Booleans get expensive fast** when inputs are high-poly.
  - Don’t boolean two very high-resolution curved surfaces unless you must.
  - Union things first, then subtract holes/cutouts in one `difference()` when possible.

- **Threads are expensive meshes.**
  - Prefer `threads.scad` modules over hand-rolled helical polyhedra.
  - Keep thread length minimal for preview iterations.

## Practical patterns

### Pattern: quality switch

```openscad
// quality can be "preview" or "final"
quality = "preview";

// Recommended defaults:
// preview: faster iteration
// final: nicer surfaces (slower)
if (quality == "preview") {
  $fn = 64;
} else {
  $fn = 128;
}
```

### Pattern: “epsilon” for robust booleans (also helps avoid weird re-render issues)

```openscad
eps = 0.01;

difference() {
  cube([20, 20, 10], center=false);
  translate([10, 10, -eps]) cylinder(h=10 + 2*eps, d=6, $fn=48);
}
```

## Avoid these when possible

- `minkowski()` on complex shapes (explodes polygon counts). Prefer:
  - 2D `offset(r=...)` + `linear_extrude()`
  - or manual fillets/chamfers on key edges only
- Very high `$fn` + knurling + threads + many booleans all at once

## Debugging slow renders

- Temporarily reduce resolution (`$fn`, `$fa`, `$fs`) and confirm geometry works first.
- Disable expensive parts with modifier `*` (disable) to isolate the culprit.
- If threads are the culprit, reduce thread length or use a lower-resolution thread setting during preview.

