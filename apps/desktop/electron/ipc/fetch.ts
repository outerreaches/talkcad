/**
 * HTTP fetch IPC handlers (bypasses CORS).
 *
 * These run in the main process with full network access, on URLs that can come
 * from model output. Every request is therefore checked against private address
 * space, follows redirects manually with the same check on each hop, and is
 * bounded in time and size.
 */
import { ipcMain } from 'electron';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { ensureProjectsDir, getProjectsDir } from '../lib/projects';
import { assertUuid, resolveWithin, sanitizePathSegment } from '../lib/safe-path';

const MAX_REDIRECTS = 5;
const HTML_TIMEOUT_MS = 15_000;
const HTML_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 20_000;
const IMAGE_MAX_BYTES = 15 * 1024 * 1024;

const BLOCKED_HOSTNAME = /(^|\.)(localhost|local|internal|lan|home\.arpa)$/i;

function ipv4ToInt(ip: string): number {
    return ip.split('.').reduce((acc, part) => (acc << 8) + (Number(part) & 0xff), 0) >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
    const n = ipv4ToInt(ip);
    const ranges: [string, number][] = [
        ['0.0.0.0', 8],
        ['10.0.0.0', 8],
        ['100.64.0.0', 10],
        ['127.0.0.0', 8],
        ['169.254.0.0', 16],
        ['172.16.0.0', 12],
        ['192.0.0.0', 24],
        ['192.168.0.0', 16],
        ['198.18.0.0', 15],
        ['224.0.0.0', 4],
        ['240.0.0.0', 4],
    ];
    return ranges.some(([base, bits]) => {
        const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
        return (n & mask) === (ipv4ToInt(base) & mask);
    });
}

function isPrivateIpv6(ip: string): boolean {
    const value = ip.toLowerCase();
    const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIpv4(mapped[1]);
    return (
        value === '::' ||
        value === '::1' ||
        value.startsWith('fc') ||
        value.startsWith('fd') ||
        /^fe[89ab]/.test(value) ||
        value.startsWith('ff')
    );
}

function isPrivateAddress(address: string): boolean {
    const family = isIP(address);
    if (family === 4) return isPrivateIpv4(address);
    if (family === 6) return isPrivateIpv6(address);
    return true;
}

/** Validate a URL and every address its hostname resolves to. */
async function assertPublicHttpUrl(raw: string): Promise<string> {
    let parsed: URL;
    try {
        parsed = new URL(raw);
    } catch {
        throw new Error('Invalid URL');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error(`Blocked URL scheme: ${parsed.protocol}`);
    }
    if (parsed.username || parsed.password) {
        throw new Error('URLs with embedded credentials are not allowed');
    }

    const host = parsed.hostname.replace(/^\[|\]$/g, '');

    if (isIP(host)) {
        if (isPrivateAddress(host)) throw new Error(`Blocked private address: ${host}`);
        return parsed.toString();
    }
    if (BLOCKED_HOSTNAME.test(host)) throw new Error(`Blocked host: ${host}`);

    let addresses: { address: string }[];
    try {
        addresses = await lookup(host, { all: true, verbatim: true });
    } catch {
        throw new Error(`Cannot resolve host: ${host}`);
    }
    if (!addresses.length) throw new Error(`Cannot resolve host: ${host}`);
    for (const { address } of addresses) {
        if (isPrivateAddress(address)) {
            throw new Error(`Blocked host resolving to private address: ${host}`);
        }
    }
    return parsed.toString();
}

/** fetch() with manual redirect handling; every hop is re-validated. */
async function safeFetch(
    rawUrl: string,
    init: RequestInit,
    opts: { timeoutMs: number }
): Promise<{ response: Response; finalUrl: string }> {
    let current = await assertPublicHttpUrl(rawUrl);

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const response = await fetch(current, {
            ...init,
            redirect: 'manual',
            signal: AbortSignal.timeout(opts.timeoutMs),
        });
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (!location) return { response, finalUrl: current };
            current = await assertPublicHttpUrl(new URL(location, current).toString());
            continue;
        }
        return { response, finalUrl: current };
    }
    throw new Error('Too many redirects');
}

/** Read a response body, aborting once it exceeds the cap. */
async function readBodyWithLimit(response: Response, maxBytes: number): Promise<Buffer> {
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared && declared > maxBytes) {
        throw new Error(`Response too large (${declared} bytes)`);
    }
    if (!response.body) {
        return Buffer.from(await response.arrayBuffer());
    }

    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel().catch(() => undefined);
            throw new Error(`Response too large (>${maxBytes} bytes)`);
        }
        chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
}

export function registerFetchHandlers() {
    ipcMain.handle('fetch:image', async (_, url: string, options?: { sessionId?: string; name?: string }) => {
        const maxRetries = 2;
        let lastError = '';
        let fetchUrl = url;

        try {
            // Transform Wikimedia thumbnail URLs
            if (url.includes('upload.wikimedia.org') && url.includes('/thumb/')) {
                fetchUrl = url.replace('/thumb/', '/').replace(/\/\d+px-[^/]+$/, '');
            }
            await assertPublicHttpUrl(fetchUrl);
        } catch (e) {
            return { success: false, error: String(e) };
        }

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const { response, finalUrl } = await safeFetch(fetchUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                        'Referer': new URL(fetchUrl).origin + '/',
                    },
                }, { timeoutMs: IMAGE_TIMEOUT_MS });

                if (response.status === 429) {
                    await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
                    continue;
                }
                if (!response.ok) {
                    if (response.status === 404) return { success: false, error: `Not found: ${finalUrl}` };
                    lastError = `HTTP ${response.status}`;
                    continue;
                }

                const contentType = response.headers.get('content-type') || 'image/png';
                const buffer = await readBodyWithLimit(response, IMAGE_MAX_BYTES);
                if (buffer.byteLength < 100) { lastError = 'Response too small'; continue; }

                const base64 = buffer.toString('base64');

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
        try {
            const { response } = await safeFetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' },
            }, { timeoutMs: HTML_TIMEOUT_MS });
            if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
            const body = await readBodyWithLimit(response, HTML_MAX_BYTES);
            return { success: true, html: body.toString('utf-8') };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    });
}
