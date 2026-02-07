/**
 * Projects directory management
 * Sessions are stored in a robust, writable location.
 */
import { app } from 'electron';
import { join } from 'path';
import { mkdir } from 'fs/promises';

/**
 * Get the projects directory path.
 *
 * Default:
 * - Development: <workspace>/projects (convenient during development)
 * - Production (packaged): <userData>/projects (always writable)
 *
 * Override:
 * - Set TALKCAD_PROJECTS_DIR to force a specific location.
 */
export function getProjectsDir(): string {
    const override = (process.env.TALKCAD_PROJECTS_DIR || '').trim();
    if (override) return override;

    const baseDir = app.isPackaged ? app.getPath('userData') : process.cwd();
    return join(baseDir, 'projects');
}

/**
 * Ensure the projects directory exists, creating it if necessary.
 */
export async function ensureProjectsDir(): Promise<string> {
    const dir = getProjectsDir();
    await mkdir(dir, { recursive: true });
    return dir;
}
