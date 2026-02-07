---
tags: [iso-273, clearance, hole, bolt, screw, fastener, tolerance, fit]
---
# ISO Fastener Clearance Holes (ISO 273)

Standard hole diameters for bolts to pass through freely. 
Do not guess hole sizes; use these standards to ensure proper assembly alignment.

## The Three Grades

1.  **Fine (H12)**: Precision assembly. Requires accurate printing/drilling. Little wiggle room.
2.  **Medium (H13)**: **Recommended for 3D Printing**. General purpose. Allows for minor misalignment.
3.  **Coarse (H14)**: Rough assembly. Use if printer calibration is poor or alignment is tricky.

## Diameter Lookup Table (mm)

| Thread | Fine (H12) | **Medium (H13)** | Coarse (H14) |
|--------|------------|------------------|--------------|
| **M2** | 2.2 | **2.4** | 2.6 |
| **M2.5** | 2.7 | **2.9** | 3.1 |
| **M3** | 3.2 | **3.4** | 3.6 |
| **M4** | 4.3 | **4.5** | 4.8 |
| **M5** | 5.3 | **5.5** | 5.8 |
| **M6** | 6.4 | **6.6** | 7.0 |
| **M8** | 8.4 | **9.0** | 10.0 |
| **M10** | 10.5 | **11.0** | 12.0 |

## 3D Printing Nuance

Vertical holes (printed along Z) often shrink due to the "polyhole" effect.
*   **Rule of Thumb**: Even if aiming for "Medium" fit, the *printed* hole might come out "Fine".
*   **Correction**: If precise fit is needed, model at **Medium** dimensions. If loose fit is needed, model at **Coarse**.
*   **Countersinks**: Countersink diameters typically = `Head Diameter + 0.5mm`.
