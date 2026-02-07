/**
 * HTTP fetch IPC handlers (bypasses CORS)
 */
import { ipcMain } from 'electron';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { ensureProjectsDir, getProjectsDir } from '../lib/projects';
import { assertUuid, resolveWithin, sanitizePathSegment } from '../lib/safe-path';

function assertSafeUrl(url: string): void {
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new Error('Invalid URL'); }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error(`Blocked URL scheme: ${parsed.protocol}`);
    }
}

export function registerFetchHandlers() {
    ipcMain.handle('fetch:image', async (_, url: string, options?: { sessionId?: string; name?: string }) => {
        try { assertSafeUrl(url); } catch (e) { return { success: false, error: String(e) }; }

        const maxRetries = 2;
        let lastError = '';
        let fetchUrl = url;

        // Transform Wikimedia thumbnail URLs
        if (url.includes('upload.wikimedia.org') && url.includes('/thumb/')) {
            fetchUrl = url.replace('/thumb/', '/').replace(/\/\d+px-[^/]+$/, '');
        }

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(fetchUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                        'Referer': new URL(fetchUrl).origin + '/',
                    },
                    redirect: 'follow',
                });

                if (response.status === 429) {
                    await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
                    continue;
                }
                if (!response.ok) {
                    if (response.status === 404) return { success: false, error: `Not found: ${fetchUrl}` };
                    lastError = `HTTP ${response.status}`;
                    continue;
                }

                const contentType = response.headers.get('content-type') || 'image/png';
                const buffer = await response.arrayBuffer();
                if (buffer.byteLength < 100) { lastError = 'Response too small'; continue; }

                const base64 = Buffer.from(buffer).toString('base64');

                if (options?.sessionId) {
                    await ensureProjectsDir();
                    const id = assertUuid(options.sessionId, 'sessionId');
                    const sessionPath = resolveWithin(getProjectsDir(), id, 'assets');
                    try { await mkdir(sessionPath, { recursive: true }); } catch { /* dir may exist */ }

                    const extMap: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/webp': 'webp' };
                    const ext = extMap[contentType] || 'png';
                    const safeName = options.name ? sanitizePathSegment(options.name, 'fetched') : `fetched-${Date.now()}`;
                    const filename = `${safeName}.${ext}`;
                    const imagePath = join(sessionPath, filename);

                    await writeFile(imagePath, new Uint8Array(buffer));
                    return { success: true, stored: true, path: join('assets', filename), absolutePath: imagePath, contentType, sizeBytes: buffer.byteLength };
                }

                return { success: true, base64, contentType };
            } catch (e) {
                lastError = String(e);
            }
        }
        return { success: false, error: `Fetch failed: ${lastError}` };
    });

    ipcMain.handle('fetch:html', async (_, url: string) => {
        try { assertSafeUrl(url); } catch (e) { return { success: false, error: String(e) }; }
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' },
            });
            if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
            return { success: true, html: await response.text() };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    });
}
