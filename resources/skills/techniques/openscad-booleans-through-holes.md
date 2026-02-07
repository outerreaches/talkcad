---
tags: [techniques, openscad, boolean, difference, through-hole, debugging]
---
# OpenSCAD Boolean Ops & Through-Holes

## Why Holes Disappear

- **Cutter too short** or mispositioned
- **Coplanar faces**: cutter flush with surface → use epsilon overshoot
- **Wrong nesting**: cutter outside `difference()` or in wrong block

## Epsilon Overshoot Pattern (CRITICAL)

Always extend cutters beyond the body:

```openscad
eps = 0.01;

difference() {
    cube([50, 50, 10]);
    // Cutter extends past both faces
    translate([25, 25, -eps])
        cylinder(h = 10 + 2*eps, d = 8, $fn = 48);
}
```

## difference() Ordering

```openscad
difference() { A(); B(); C(); }  // Result: A - B - C
```
First child = keep, subsequent children = subtract.

## Debugging Modifiers

- `#` highlight object (see if cutter intersects)
- `!` show only that object (verify cutter exists)
- `%` transparent, `*` disable

## Common Mistakes

### 1. Hollow container missing difference()

```openscad
// ❌ WRONG - solid, no cavity
union() {
    cylinder(d=30, h=40);
    ScrewThread(20, 10);
}

// ✅ CORRECT
difference() {
    union() {
        cylinder(d=30, h=40);
        translate([0,0,40]) ScrewThread(20, 10);
    }
    translate([0, 0, 2]) cylinder(d=26, h=50);  // Hollow interior
}
```

### 2. Holes added but not subtracted

```openscad
// ❌ WRONG - cylinders added, not cut
cube([50, 30, 5]);
translate([10, 15, -0.01]) cylinder(d=4, h=5.02);

// ✅ CORRECT
difference() {
    cube([50, 30, 5]);
    translate([10, 15, -0.01]) cylinder(d=4, h=5.02);
}
```

### 3. Cutter outside difference block

```openscad
// ❌ WRONG
difference() { cube([50,50,10]); }
translate([25,25,-0.01]) cylinder(d=10, h=10.02);  // Not subtracted!

// ✅ CORRECT - cutter inside difference()
difference() {
    cube([50, 50, 10]);
    translate([25, 25, -0.01]) cylinder(d=10, h=10.02);
}
```

## Self-Check

1. Every cavity/hole is inside a `difference()` block
2. All cutters use epsilon overshoot
3. First child of `difference()` is the body you're keeping
