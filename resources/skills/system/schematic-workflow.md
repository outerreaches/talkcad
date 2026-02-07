---
tags: [system, schematic, svg, workflow, import]
---
# Working with Schematic Images

## When to Use This Workflow
Use when you need to model complex 2D shapes (outlines, profiles, cross-sections) from reference images.

## Approach

### Option 1: User Provides SVG/DXF
If the user has a vector file, import it directly in OpenSCAD.

### Option 2: Search for Existing Vector Art
Search for "component name SVG" or "component name DXF outline" to find ready-to-use vector files.

### Option 3: Manual Tracing from Dimensions
If only raster images or datasheets are available:
1. Extract key dimensions from the datasheet
2. Model the outline using OpenSCAD primitives (polygon, circles, etc.)
3. This is often more reliable than automated vectorization

## Importing SVG/DXF in OpenSCAD

```openscad
// Basic import and extrude
linear_extrude(height = 5)
  import("assets/servo-outline.svg", center = true);

// With scaling (SVG units vary - calibrate with known dimension)
linear_extrude(height = 5)
  scale([0.1, 0.1, 1])  // Adjust based on actual size
    import("assets/outline.svg", center = true);

// For complex paths, add convexity for correct preview
linear_extrude(height = 5, convexity = 10)
  import("assets/complex-shape.dxf");
```

## Tips for Best Results
- SVG imports often have arbitrary units; **calibrate scale using a known dimension**
- DXF is often more reliable than SVG for CAD interchange
- B&W line art with closed paths works best
- Check that paths are closed (no gaps) before extruding
- Use `convexity` parameter for shapes with many concave regions

## When Dimensions Aren't Available
1. Do at most 2 web searches for datasheets/drawings
2. If no dimensions found, ask user for:
   - A photo with a ruler/reference object
   - The datasheet or manufacturer drawing
   - Key dimensions they can measure
