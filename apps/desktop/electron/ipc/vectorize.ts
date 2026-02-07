/**
 * Image vectorization IPC handlers (potrace)
 */
import { ipcMain } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import Potrace from 'potrace';
import { getProjectsDir } from '../lib/projects';
import { assertUuid, normalizeRelativePath, resolveWithin } from '../lib/safe-path';

function traceImage(imageBuffer: Buffer, options: Potrace.PotraceOptions): Promise<string> {
    return new Promise((resolve, reject) => {
        Potrace.trace(imageBuffer, options, (err, svg) => {
            if (err) reject(err);
            else resolve(svg);
        });
    });
}

export function registerVectorizeHandlers() {
    ipcMain.handle('vectorize:image', async (_, args: {
        base64?: string; imagePath?: string; sessionId: string; name?: string; threshold?: number;
    }) => {
        const { name, threshold = 128 } = args;
        const sessionId = assertUuid(args.sessionId, 'sessionId');
        let base64 = args.base64;
        const sessionPath = resolveWithin(getProjectsDir(), sessionId, 'assets');

        try { await mkdir(sessionPath, { recursive: true }); } catch { /* dir may exist */ }

        if (!base64 && args.imagePath) {
            let imagePath: string;
            try {
                imagePath = resolveWithin(getProjectsDir(), sessionId, normalizeRelativePath(args.imagePath));
            } catch {
                return { success: false, error: 'Invalid path' };
            }
            if (!existsSync(imagePath)) return { success: false, error: `Not found: ${args.imagePath}` };
            try {
                base64 = (await readFile(imagePath)).toString('base64');
            } catch (e) { return { success: false, error: String(e) }; }
        }

        if (!base64) return { success: false, error: 'base64 or imagePath required' };

        const filename = name ? name.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.svg' : `shape-${Date.now()}.svg`;
        const svgPath = join(sessionPath, filename);

        try {
            const imageBuffer = Buffer.from(base64, 'base64');
            const contentStart = imageBuffer.slice(0, 100).toString('utf-8').trim().toLowerCase();

            // Already SVG
            if (contentStart.startsWith('<?xml') || contentStart.startsWith('<svg') || contentStart.includes('<svg')) {
                const svgContent = imageBuffer.toString('utf-8');
                await writeFile(svgPath, svgContent, 'utf-8');
                return { success: true, path: join('assets', filename), absolutePath: svgPath, svg: svgContent, note: 'Already SVG' };
            }

            // Validate raster format
            const isPNG = imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50;
            const isJPEG = imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8;
            const isGIF = imageBuffer[0] === 0x47 && imageBuffer[1] === 0x49;
            const isBMP = imageBuffer[0] === 0x42 && imageBuffer[1] === 0x4D;

            if (!isPNG && !isJPEG && !isGIF && !isBMP) {
                return { success: false, error: 'Unsupported format. Need PNG, JPEG, GIF, or BMP.' };
            }

            const svg = await traceImage(imageBuffer, { threshold, turdSize: 2, optCurve: true, alphaMax: 1, optTolerance: 0.2 });
            await writeFile(svgPath, svg);
            return { success: true, path: join('assets', filename), absolutePath: svgPath, svg };
        } catch (e) {
            return { success: false, error: `Vectorization failed: ${String(e)}` };
        }
    });
}
