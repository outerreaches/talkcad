/**
 * PDF parsing IPC handlers
 */
import { ipcMain } from 'electron';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { ensureProjectsDir, getProjectsDir } from '../lib/projects';
import { assertUuid, resolveWithin, sanitizePathSegment } from '../lib/safe-path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

export function registerPdfHandlers() {
    ipcMain.handle('pdf:extractImages', async (_, args: { url?: string; base64?: string; sessionId?: string; name?: string }) => {
        try {
            let pdfBuffer: Buffer;

            if (args.url) {
                const response = await fetch(args.url);
                if (!response.ok) return { success: false, error: `Fetch failed: ${response.status}` };
                pdfBuffer = Buffer.from(await response.arrayBuffer());
            } else if (args.base64) {
                pdfBuffer = Buffer.from(args.base64, 'base64');
            } else {
                return { success: false, error: 'url or base64 required' };
            }

            const data = await pdfParse(pdfBuffer);

            // Extract embedded images (no rendering). This may return 0 images for vector-only PDFs.
            let imageBuffers: Buffer[] = [];
            try {
                const mod: any = await import('pdf-extract-image');
                const extractor =
                    mod?.extractImagesFromPdf ||
                    mod?.extractImagesFromPDF ||
                    mod?.extractImages ||
                    mod?.default;
                if (typeof extractor === 'function') {
                    imageBuffers = (await extractor(pdfBuffer)) as Buffer[];
                }
            } catch {
                // If extraction isn't available, keep text-only behavior.
                imageBuffers = [];
            }

            const parsePngSize = (buf: Buffer): { width: number; height: number } => {
                // PNG IHDR width/height are big-endian at fixed offsets.
                // Signature (8) + length (4) + type (4) => data starts at 16
                if (buf.length < 24) return { width: 0, height: 0 };
                const sig = buf.subarray(0, 8);
                const isPng = sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47;
                if (!isPng) return { width: 0, height: 0 };
                const width = buf.readUInt32BE(16);
                const height = buf.readUInt32BE(20);
                return { width, height };
            };

            const images: Array<{ index: number; width: number; height: number; base64?: string; path?: string; sizeBytes: number }> = [];
            let storedCount = 0;

            // If sessionId provided, store extracted images under session assets.
            let assetsDir: string | null = null;
            if (args.sessionId) {
                try {
                    await ensureProjectsDir();
                    const sid = assertUuid(args.sessionId, 'sessionId');
                    assetsDir = resolveWithin(getProjectsDir(), sid, 'assets');
                    await mkdir(assetsDir, { recursive: true });
                } catch {
                    assetsDir = null;
                }
            }

            const prefix = sanitizePathSegment(args.name || 'pdf', 'pdf');
            const maxImages = 25;
            for (let i = 0; i < Math.min(imageBuffers.length, maxImages); i++) {
                const buf = imageBuffers[i];
                const { width, height } = parsePngSize(buf);

                const entry: { index: number; width: number; height: number; base64?: string; path?: string; sizeBytes: number } = {
                    index: i,
                    width,
                    height,
                    sizeBytes: buf.length,
                };

                if (assetsDir) {
                    const filename = `${prefix}-${Date.now()}-img-${i + 1}.png`;
                    const abs = join(assetsDir, filename);
                    await writeFile(abs, new Uint8Array(buf));
                    entry.path = join('assets', filename);
                    storedCount++;
                } else {
                    entry.base64 = buf.toString('base64');
                }

                images.push(entry);
            }

            return {
                success: true,
                pageCount: data.numpages,
                text: data.text.slice(0, 8000),
                metadata: data.info,
                images,
                imageCount: images.length,
                stored: storedCount > 0,
                note: images.length > 0
                    ? (storedCount > 0
                        ? 'Extracted embedded images and stored them in session assets.'
                        : 'Extracted embedded images (returned as base64).')
                    : 'No embedded images found in this PDF. (Many schematics are vector-only.)',
            };
        } catch (e) {
            return { success: false, error: `PDF parsing failed: ${String(e)}` };
        }
    });
}
