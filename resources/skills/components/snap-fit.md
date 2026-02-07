---
tags: [snap-fit, cantilever, fastener, clip, latch, pla, petg, abs]
---
# Snap-Fit Design

Guidelines for designing snap-fit connections for 3D printed parts.

## Key Facts

- Snap-fits are one-piece fasteners that lock parts together
- Material strain limit determines design parameters
- FDM layer orientation affects snap-fit strength
- Cantilever beam type is most common

## Material Strain Limits

| Material | Max Strain | Notes |
|----------|------------|-------|
| PLA | 2-3% | Brittle, use short deflection |
| PETG | 4-5% | Good for snap-fits |
| ABS | 3-4% | Good with proper printing |
| TPU | 20%+ | Very flexible |
| Nylon | 5-7% | Excellent fatigue resistance |

## Cantilever Snap-Fit Design

### Key Parameters

- **Length (L)**: Longer = more flexible, easier to engage
- **Thickness (t)**: Thinner = more flexible, but weaker
- **Width (w)**: Affects engagement force linearly
- **Deflection (y)**: How far the tab must bend
- **Lead angle**: 30-45° for easy engagement
- **Return angle**: 45-90° for retention

### Design Formula

```
Deflection (y) = (ε × L²) / (6 × t)

Where:
  ε = material strain limit (decimal, e.g., 0.04 for PETG)
  L = beam length
  t = beam thickness

Note: This is the max-strain approximation for a rectangular cantilever.
For repeated use, design for 50% of max strain to avoid fatigue failure.
```

### Recommended Proportions

| Ratio | Recommended | Notes |
|-------|-------------|-------|
| L/t | 5-10 | Higher = easier engagement |
| y/L | 0.02-0.05 | Based on strain limit |
| Lead angle | 30-45° | Easier engagement |
| Return angle | 60-90° | Better retention |

## Clearances

| Material | Clearance | Notes |
|----------|-----------|-------|
| PLA | 0.2-0.25mm | Tight fit |
| PETG | 0.25-0.35mm | Slight flex |
| ABS | 0.2-0.3mm | After shrinkage |

## FDM Printing Considerations

1. **Orientation**: Print so layers are perpendicular to deflection
2. **Overhangs**: Design tabs with <45° undercuts
3. **Lead-in chamfer**: Add 45° chamfer for printability
4. **Tab thickness**: Minimum 1.5mm (4 perimeters at 0.4mm)

## Common Mistakes

- Tab too short → breaks instead of flexing
- Tab too thick → requires excessive force
- Sharp corners → stress concentration, breaks
- Wrong print orientation → delaminates under stress
- No lead-in angle → hard to engage, damages tab

## OpenSCAD Patterns

```openscad
// Cantilever snap-fit tab
module snap_tab(
    length = 10,      // Tab length
    width = 5,        // Tab width
    thickness = 1.5,  // Tab thickness
    deflection = 0.8, // Hook deflection
    lead_angle = 45,  // Lead-in angle
    return_angle = 75 // Return/lock angle
) {
    // Main cantilever beam
    cube([length, width, thickness]);

    // Hook at end
    translate([length, 0, 0]) {
        // Lead-in ramp
        hull() {
            cube([0.1, width, thickness]);
            translate([deflection * tan(lead_angle), 0, deflection])
                cube([0.1, width, thickness]);
        }
        // Return surface
        translate([deflection * tan(lead_angle), 0, deflection])
            rotate([0, return_angle - 90, 0])
                cube([deflection / sin(return_angle), width, thickness]);
    }
}

// Mating slot for snap-fit
module snap_slot(
    length = 10,
    width = 5,
    thickness = 1.5,
    deflection = 0.8,
    clearance = 0.3
) {
    slot_depth = deflection + clearance;
    slot_width = width + clearance * 2;
    slot_length = length + clearance;

    translate([-clearance, -clearance, 0])
        cube([slot_length, slot_width, thickness + clearance]);

    // Engagement pocket
    translate([slot_length - clearance, -clearance, 0])
        cube([slot_depth + clearance, slot_width, thickness + slot_depth]);
}

// Complete snap-fit pair demo
module snap_fit_demo() {
    // Part A with tabs
    color("SteelBlue") {
        cube([30, 20, 3]);
        translate([25, 2.5, 3])
            snap_tab(10, 5, 1.5, 0.8);
        translate([25, 12.5, 3])
            snap_tab(10, 5, 1.5, 0.8);
    }

    // Part B with slots
    translate([0, 0, 10])
    color("Coral") {
        difference() {
            cube([30, 20, 3]);
            translate([25, 2.5, 0])
                snap_slot(10, 5, 1.5, 0.8, 0.3);
            translate([25, 12.5, 0])
                snap_slot(10, 5, 1.5, 0.8, 0.3);
        }
    }
}
```

## Tips for Success

1. **Test iteratively**: Print test pieces to dial in clearances
2. **Add fillets**: Round inside corners to prevent cracking
3. **Consider fatigue**: For repeated use, design for 50% of max strain
4. **Assembly direction**: Design so parts only go together one way
5. **Access**: Ensure user can reach to disengage if needed
