/**
 * OpenSCAD utility functions shared across IPC handlers
 */

// OpenSCAD executable paths by platform
export const OPENSCAD_PATHS = {
    darwin: [
        '/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD',
        '/Applications/OpenSCAD-2021.01.app/Contents/MacOS/OpenSCAD',
        '/opt/homebrew/bin/openscad',
        '/usr/local/bin/openscad',
    ],
    win32: [
        'C:\\Program Files\\OpenSCAD\\openscad.exe',
        'C:\\Program Files (x86)\\OpenSCAD\\openscad.exe',
    ],
    linux: [
        '/usr/bin/openscad',
        '/usr/local/bin/openscad',
        '/snap/bin/openscad',
    ],
} as const;

// Camera positions for verification image rendering
// OpenSCAD coordinate system: X=Right, Y=Back, Z=Up
export const CAMERA_POSITIONS: Record<string, string> = {
    front: '0,-100,0,0,0,0',
    back: '0,100,0,0,0,0',
    left: '-100,0,0,0,0,0',
    right: '100,0,0,0,0,0',
    top: '0,0,100,0,0,0',
    bottom: '0,0,-100,0,0,0',
    iso: '100,-100,80,0,0,0',
};

/**
 * Parse OpenSCAD output for errors and warnings
 */
export function parseDiagnostics(
    text: string,
    mode: 'preview' | 'final'
): { errors: string[]; warnings: string[] } {
    const lines = text.split('\n');
    const unique = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));

    const rawErrors = unique(
        lines
            .filter((line) =>
                line.includes('ERROR') || line.includes('Parser error') || line.includes('Compile error')
            )
            .map((line) => line.trim())
    );

    const rawWarnings = unique(
        lines
            .filter((line) => line.includes('WARNING'))
            .map((line) => line.trim())
    );

    // Preview mode: treat warnings as errors (--hardwarnings)
    if (mode === 'preview') {
        return {
            errors: unique([...rawErrors, ...rawWarnings]).slice(0, 20),
            warnings: [],
        };
    }

    // Final mode: promote critical warnings to errors
    const criticalPatterns = [
        'Unable to convert',
        'Unknown function',
        'Unknown module',
        'Ignoring unknown',
        'Current top level object is empty',
    ];

    const criticalWarnings = rawWarnings.filter((warning) =>
        criticalPatterns.some((pattern) => warning.includes(pattern))
    );

    return {
        errors: unique([...rawErrors, ...criticalWarnings]).slice(0, 20),
        warnings: unique(rawWarnings.filter((w) => !criticalWarnings.includes(w))).slice(0, 20),
    };
}

/**
 * Parse binary STL file to extract mesh statistics.
 * Binary STL format:
 * - 80 bytes: header
 * - 4 bytes: uint32 triangle count
 * - Per triangle (50 bytes each): normal + 3 vertices + attribute
 */
export function parseStlStats(buffer: Buffer): {
    triangles: number;
    dimensions: { x: number; y: number; z: number };
    manifold: boolean;
} {
    if (buffer.length < 84) {
        return { triangles: 0, dimensions: { x: 0, y: 0, z: 0 }, manifold: true };
    }

    const triangles = buffer.readUInt32LE(80);
    const expectedSize = 84 + triangles * 50;

    if (buffer.length < expectedSize) {
        return { triangles: 0, dimensions: { x: 0, y: 0, z: 0 }, manifold: true };
    }

    // Calculate bounding box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (let i = 0; i < triangles; i++) {
        const offset = 84 + i * 50;
        for (let v = 0; v < 3; v++) {
            const vertexOffset = offset + 12 + v * 12;
            const x = buffer.readFloatLE(vertexOffset);
            const y = buffer.readFloatLE(vertexOffset + 4);
            const z = buffer.readFloatLE(vertexOffset + 8);

            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
        }
    }

    return {
        triangles,
        dimensions: {
            x: triangles > 0 ? maxX - minX : 0,
            y: triangles > 0 ? maxY - minY : 0,
            z: triangles > 0 ? maxZ - minZ : 0,
        },
        manifold: true, // Full manifold detection requires edge analysis
    };
}

/**
 * Truncate log output for error messages
 */
export function truncateLog(text: unknown, maxChars = 8000, maxLines = 200): string {
    if (typeof text !== 'string' || text.length === 0) return '';
    let out = text;

    const lines = out.split(/\r?\n/);
    if (lines.length > maxLines) {
        const headCount = Math.floor(maxLines * 0.6);
        const tailCount = maxLines - headCount;
        out = `${lines.slice(0, headCount).join('\n')}\n...[${lines.length - maxLines} lines truncated]...\n${lines.slice(-tailCount).join('\n')}`;
    }

    if (out.length > maxChars) {
        const headChars = Math.floor(maxChars * 0.6);
        const tailChars = maxChars - headChars;
        out = `${out.slice(0, headChars)}\n...[${out.length - maxChars} chars truncated]...\n${out.slice(-tailChars)}`;
    }

    return out;
}
