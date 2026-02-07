/**
 * Bundled asset resolution and OpenSCAD library management
 */
import { app } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';

/**
 * Resolve a bundled asset path, checking multiple locations.
 * In dev: assets live under the workspace app path.
 * In production: assets may be in app.asar or resources.
 */
export function resolveBundledAssetPath(relPath: string): string | null {
    const candidates = [
        join(app.getAppPath(), relPath),
        join(process.resourcesPath, relPath),
    ];
    for (const p of candidates) {
        if (existsSync(p)) return p;
    }
    return null;
}

/**
 * Get the OpenSCAD libraries directory (user-specific, not per-session).
 * Cross-platform:
 * - macOS: ~/Library/Application Support/<App>/openscad/libraries
 * - Windows: %APPDATA%/<App>/openscad/libraries
 * - Linux: ~/.config/<App>/openscad/libraries
 */
export function getOpenSCADLibrariesDir(): string {
    return join(app.getPath('userData'), 'openscad', 'libraries');
}

/**
 * Ensure bundled OpenSCAD libraries are installed to user directory.
 */
export async function ensureBundledLibraries(): Promise<void> {
    const librariesDir = getOpenSCADLibrariesDir();
    await mkdir(librariesDir, { recursive: true });

    // threads.scad (CC0 license)
    const threadsDest = join(librariesDir, 'threads.scad');
    if (!existsSync(threadsDest)) {
        const rel = join('assets', 'openscad', 'libraries', 'threads.scad');
        const threadsSrc = resolveBundledAssetPath(rel);
        if (!threadsSrc) {
            console.warn(`[TalkCAD] Bundled OpenSCAD library not found: ${rel}`);
            return;
        }
        const content = await readFile(threadsSrc, 'utf-8');
        await writeFile(threadsDest, content, 'utf-8');
    }
}
