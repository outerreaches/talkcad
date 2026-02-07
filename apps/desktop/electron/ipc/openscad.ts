/**
 * OpenSCAD IPC handlers
 */
import { ipcMain } from 'electron';
import { join, delimiter } from 'path';
import { existsSync } from 'fs';
import { readFile, writeFile, unlink } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { OPENSCAD_PATHS, CAMERA_POSITIONS, parseDiagnostics, parseStlStats, truncateLog } from '../lib/openscad';
import { getOpenSCADLibrariesDir } from '../lib/assets';

const execFileAsync = promisify(execFile);
let openscadPath: string | null = null;

async function detectOpenSCAD(): Promise<string | null> {
    const platform = process.platform as 'darwin' | 'win32' | 'linux';
    const paths = OPENSCAD_PATHS[platform] || [];
    for (const p of paths) {
        if (existsSync(p)) {
            openscadPath = p;
            return p;
        }
    }
    return null;
}

export { detectOpenSCAD };

export function registerOpenscadHandlers() {
    ipcMain.handle('openscad:detectPath', () => detectOpenSCAD());
    ipcMain.handle('openscad:setPath', (_, path: string) => { openscadPath = path; });
    ipcMain.handle('openscad:getLibrariesDir', () => getOpenSCADLibrariesDir());

    ipcMain.handle('openscad:getVersion', async () => {
        if (!openscadPath) return null;
        try {
            const { stdout, stderr } = await execFileAsync(openscadPath, ['--version']);
            return (stdout || stderr).trim();
        } catch { return null; }
    });

    ipcMain.handle('openscad:validate', async (_, code: string, options?: { mode?: 'preview' | 'final'; geometry?: boolean }) => {
        if (!openscadPath) return { valid: false, errors: ['OpenSCAD not found'], warnings: [] };

        const mode = options?.mode || 'final';
        const doGeometry = options?.geometry ?? false;
        const id = randomUUID();
        const inputFile = join(tmpdir(), `talkcad-validate-${id}.scad`);
        const outputFile = join(tmpdir(), `talkcad-validate-${id}.${doGeometry ? 'stl' : 'echo'}`);

        try {
            await writeFile(inputFile, code);
            const env = { ...process.env, OPENSCADPATH: [getOpenSCADLibrariesDir(), process.env.OPENSCADPATH].filter(Boolean).join(delimiter) };
            const args: string[] = [];
            if (mode === 'preview') { args.push('--hardwarnings', '-D', '$fn=64', '-D', 'screw_resolution=0.8'); }
            args.push('--export-format', doGeometry ? 'binstl' : 'echo', '-o', outputFile, inputFile);

            const { stdout, stderr } = await execFileAsync(openscadPath, args, { timeout: 30000, maxBuffer: 5 * 1024 * 1024, env });
            const { errors, warnings } = parseDiagnostics([stdout, stderr].join('\n'), mode);
            await unlink(inputFile).catch(() => { });
            await unlink(outputFile).catch(() => { });
            return { valid: errors.length === 0, errors, warnings };
        } catch (e: unknown) {
            const err = e as { stdout?: string; stderr?: string; message?: string };
            await unlink(inputFile).catch(() => { });
            await unlink(outputFile).catch(() => { });
            const { errors, warnings } = parseDiagnostics([err.stdout, err.stderr].filter(Boolean).join('\n'), mode);
            return { valid: false, errors: errors.length > 0 ? errors : [err.message || 'Validation failed'], warnings };
        }
    });

    ipcMain.handle('openscad:render', async (_, code: string, format: string, options?: { mode?: 'preview' | 'final' }) => {
        if (!openscadPath) return { success: false, errors: ['OpenSCAD not found'] };

        const mode = options?.mode || 'final';
        const id1 = randomUUID(), id2 = randomUUID();
        const inputFile = join(tmpdir(), `talkcad-${id1}.scad`);
        const outputFile = join(tmpdir(), `talkcad-${id2}.${format}`);

        try {
            await writeFile(inputFile, code);
            const env = { ...process.env, OPENSCADPATH: [getOpenSCADLibrariesDir(), process.env.OPENSCADPATH].filter(Boolean).join(delimiter) };
            const startedAt = Date.now();

            // Pre-validate
            const validateFile = join(tmpdir(), `talkcad-validate-${id1}.echo`);
            const validateArgs = mode === 'preview' ? ['--hardwarnings', '-D', '$fn=64', '-D', 'screw_resolution=0.8'] : [];
            validateArgs.push('--export-format', 'echo', '-o', validateFile, inputFile);

            try {
                const { stdout, stderr } = await execFileAsync(openscadPath, validateArgs, { timeout: 30000, maxBuffer: 5 * 1024 * 1024, env });
                const { errors } = parseDiagnostics([stdout, stderr].join('\n'), mode);
                if (errors.length > 0) {
                    await unlink(validateFile).catch(() => { });
                    return { success: false, format, errors };
                }
            } catch (ve: unknown) {
                const verr = ve as { stdout?: string; stderr?: string; message?: string };
                const { errors } = parseDiagnostics([verr.stdout, verr.stderr].filter(Boolean).join('\n'), mode);
                await unlink(validateFile).catch(() => { });
                return { success: false, format, errors: errors.length > 0 ? errors : [verr.message || 'Validation failed'] };
            }
            await unlink(validateFile).catch(() => { });

            // Render
            const args = mode === 'preview' ? ['--hardwarnings', '-D', '$fn=64', '-D', 'screw_resolution=0.8'] : [];
            if (format === 'stl') args.push('--export-format', 'binstl');
            args.push('-o', outputFile, inputFile);

            const { stdout, stderr } = await execFileAsync(openscadPath, args, { timeout: 180000, maxBuffer: 10 * 1024 * 1024, env });
            const output = await readFile(outputFile);
            const base64 = output.toString('base64');
            const combined = [stdout, stderr].join('\n');
            const warnings = Array.from(new Set(combined.split('\n').filter(l => l.includes('WARNING')).map(l => l.trim()))).slice(0, 50);
            const hasManifoldWarn = combined.toLowerCase().includes('not valid 2-manifold');
            const stlStats = parseStlStats(output);

            await unlink(inputFile).catch(() => { });
            await unlink(outputFile).catch(() => { });

            return {
                success: true, format, output: base64, warnings,
                stats: { dimensions: stlStats.dimensions, volume: 0, surfaceArea: 0, manifold: !hasManifoldWarn && stlStats.manifold, triangles: stlStats.triangles, renderTime: (Date.now() - startedAt) / 1000 },
            };
        } catch (e: unknown) {
            const err = e as { code?: unknown; signal?: unknown; killed?: unknown; message?: string; stdout?: string; stderr?: string };
            if (outputFile) await unlink(outputFile).catch(() => { });
            const detail = `OpenSCAD failed (code=${err.code ?? 'unknown'}, signal=${err.signal ?? 'none'}, killed=${err.killed ?? false})`;
            return { success: false, format, errors: [detail, err.message || 'Render failed', truncateLog(err.stderr), truncateLog(err.stdout)].filter(Boolean) };
        }
    });

    ipcMain.handle('openscad:parseStlStats', async (_, base64Data: string) => {
        try {
            const buffer = Buffer.from(base64Data, 'base64');
            const stats = parseStlStats(buffer);
            return { dimensions: stats.dimensions, volume: 0, surfaceArea: 0, manifold: stats.manifold, triangles: stats.triangles, renderTime: 0 };
        } catch { return null; }
    });

    ipcMain.handle('openscad:renderImage', async (_, code: string, angle: string, options?: { width?: number; height?: number }) => {
        if (!openscadPath) return { success: false, error: 'OpenSCAD not set' };
        const cameraPosition = CAMERA_POSITIONS[angle];
        if (!cameraPosition) return { success: false, error: `Unknown angle: ${angle}` };

        const id = randomUUID();
        const inputFile = join(tmpdir(), `talkcad-verify-${id}.scad`);
        const outputFile = join(tmpdir(), `talkcad-verify-${id}.png`);
        const width = options?.width ?? 800, height = options?.height ?? 600;

        try {
            await writeFile(inputFile, code, 'utf-8');
            const env = { ...process.env, OPENSCADPATH: [getOpenSCADLibrariesDir(), process.env.OPENSCADPATH].filter(Boolean).join(delimiter) };
            await execFileAsync(openscadPath, ['-o', outputFile, '--camera', cameraPosition, '--projection', 'o', '--imgsize', `${width},${height}`, '--autocenter', '--viewall', '--colorscheme', 'Tomorrow', inputFile], { timeout: 60000, maxBuffer: 10 * 1024 * 1024, env });
            const base64 = (await readFile(outputFile)).toString('base64');
            return { success: true, image: base64 };
        } catch (e: unknown) {
            const err = e as { stderr?: string; message?: string };
            return { success: false, error: err.stderr || err.message || String(e) };
        } finally {
            await unlink(inputFile).catch(() => { });
            await unlink(outputFile).catch(() => { });
        }
    });
}
