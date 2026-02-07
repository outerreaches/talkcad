/**
 * Session management IPC handlers
 */
import { ipcMain } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';
import { readdir, readFile, writeFile, mkdir, rm, stat } from 'fs/promises';
import { randomUUID } from 'crypto';
import { getProjectsDir, ensureProjectsDir } from '../lib/projects';
import { assertUuid, normalizeRelativePath, resolveWithin } from '../lib/safe-path';

export function registerSessionHandlers() {
    ipcMain.handle('session:getProjectsDir', () => getProjectsDir());

    ipcMain.handle('session:list', async () => {
        await ensureProjectsDir();
        const entries = await readdir(getProjectsDir(), { withFileTypes: true });
        const sessions = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const sessionPath = join(getProjectsDir(), entry.name);
                const metaPath = join(sessionPath, 'session.json');
                try {
                    const meta = JSON.parse(await readFile(metaPath, 'utf-8'));
                    sessions.push({ id: entry.name, path: sessionPath, ...meta });
                } catch { /* skip invalid */ }
            }
        }
        sessions.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
        return sessions;
    });

    ipcMain.handle('session:create', async (_, name?: string) => {
        await ensureProjectsDir();
        const id = randomUUID();
        const sessionPath = resolveWithin(getProjectsDir(), id);
        await mkdir(sessionPath, { recursive: true });
        await mkdir(join(sessionPath, 'assets'), { recursive: true });

        const now = new Date().toISOString();
        const meta = { name: name || `Session ${new Date().toLocaleDateString()}`, created: now, modified: now };
        await writeFile(join(sessionPath, 'session.json'), JSON.stringify(meta, null, 2));
        await writeFile(join(sessionPath, 'chat.json'), '[]');
        await writeFile(join(sessionPath, 'specs.json'), '{}');
        await writeFile(join(sessionPath, 'code.scad'), '');
        return { id, path: sessionPath, ...meta };
    });

    ipcMain.handle('session:load', async (_, sessionId: string) => {
        await ensureProjectsDir();
        const id = assertUuid(sessionId, 'sessionId');
        const sessionPath = resolveWithin(getProjectsDir(), id);
        if (!existsSync(sessionPath)) return null;

        try {
            const meta = JSON.parse(await readFile(join(sessionPath, 'session.json'), 'utf-8'));
            const chat = JSON.parse(await readFile(join(sessionPath, 'chat.json'), 'utf-8').catch(() => '[]'));
            const specs = JSON.parse(await readFile(join(sessionPath, 'specs.json'), 'utf-8').catch(() => '{}'));
            const code = await readFile(join(sessionPath, 'code.scad'), 'utf-8').catch(() => '');
            const stlPath = join(sessionPath, 'model.stl');
            let stlData: string | null = null;
            if (existsSync(stlPath)) {
                stlData = (await readFile(stlPath)).toString('base64');
            }
            let history;
            try { history = JSON.parse(await readFile(join(sessionPath, 'history.json'), 'utf-8')); } catch { /* optional */ }
            return { id: sessionId, path: sessionPath, meta, chat, specs, code, stlData, history };
        } catch { /* session not found */ return null; }
    });

    ipcMain.handle('session:save', async (_, sessionId: string, data: { chat?: unknown[]; specs?: Record<string, unknown>; code?: string; stlData?: string; name?: string; history?: unknown }) => {
        await ensureProjectsDir();
        const id = assertUuid(sessionId, 'sessionId');
        const sessionPath = resolveWithin(getProjectsDir(), id);
        if (!existsSync(sessionPath)) await mkdir(sessionPath, { recursive: true });

        const metaPath = join(sessionPath, 'session.json');
        let meta = { name: 'Untitled', created: new Date().toISOString(), modified: new Date().toISOString() };
        try { meta = JSON.parse(await readFile(metaPath, 'utf-8')); } catch { /* new session */ }

        if (data.name) meta.name = data.name;
        meta.modified = new Date().toISOString();
        await writeFile(metaPath, JSON.stringify(meta, null, 2));

        if (data.chat) await writeFile(join(sessionPath, 'chat.json'), JSON.stringify(data.chat, null, 2));
        if (data.specs) await writeFile(join(sessionPath, 'specs.json'), JSON.stringify(data.specs, null, 2));
        if (data.code !== undefined) await writeFile(join(sessionPath, 'code.scad'), data.code);
        if (data.stlData) await writeFile(join(sessionPath, 'model.stl'), new Uint8Array(Buffer.from(data.stlData, 'base64')));
        if (data.history) await writeFile(join(sessionPath, 'history.json'), JSON.stringify(data.history, null, 2));

        return meta;
    });

    ipcMain.handle('session:delete', async (_, sessionId: string) => {
        await ensureProjectsDir();
        const id = assertUuid(sessionId, 'sessionId');
        const sessionPath = resolveWithin(getProjectsDir(), id);
        if (existsSync(sessionPath)) await rm(sessionPath, { recursive: true });
    });

    ipcMain.handle('session:rename', async (_, sessionId: string, newName: string) => {
        await ensureProjectsDir();
        const id = assertUuid(sessionId, 'sessionId');
        const metaPath = resolveWithin(getProjectsDir(), id, 'session.json');
        const meta = JSON.parse(await readFile(metaPath, 'utf-8'));
        meta.name = newName;
        meta.modified = new Date().toISOString();
        await writeFile(metaPath, JSON.stringify(meta, null, 2));
        return meta;
    });

    ipcMain.handle('session:storeUserAsset', async (_, args: { sessionId: string; base64: string; name?: string; mimeType?: string }) => {
        await ensureProjectsDir();
        const id = assertUuid(args.sessionId, 'sessionId');
        const assetsDir = resolveWithin(getProjectsDir(), id, 'assets');
        await mkdir(assetsDir, { recursive: true });

        const mime = (args.mimeType || '').toLowerCase().trim();
        const extMap: Record<string, string> = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/svg+xml': 'svg',
            'application/pdf': 'pdf',
        };
        const ext = extMap[mime] || mime.split('/')[1] || 'bin';
        const filename = args.name ? args.name.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.' + ext : `asset-${Date.now()}.${ext}`;
        const assetPath = join(assetsDir, filename);
        const buffer = Buffer.from(args.base64, 'base64');
        await writeFile(assetPath, new Uint8Array(buffer));

        return { success: true, path: join('assets', filename), absolutePath: assetPath, filename, sizeBytes: buffer.length };
    });

    ipcMain.handle('session:readAsset', async (_, args: { sessionId: string; assetPath: string }) => {
        await ensureProjectsDir();
        const id = assertUuid(args.sessionId, 'sessionId');
        const rel = normalizeRelativePath(args.assetPath);
        let assetPath: string;
        try {
            assetPath = resolveWithin(getProjectsDir(), id, rel);
        } catch {
            return { success: false, error: 'Invalid path' };
        }
        if (!existsSync(assetPath)) return { success: false, error: 'Not found' };

        try {
            const buffer = await readFile(assetPath);
            const ext = assetPath.split('.').pop()?.toLowerCase();
            const typeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', gif: 'image/gif' };
            return { success: true, base64: buffer.toString('base64'), contentType: typeMap[ext || ''] || 'application/octet-stream', sizeBytes: buffer.length };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    });

    ipcMain.handle('session:listAssets', async (_, sessionId: string) => {
        await ensureProjectsDir();
        const id = assertUuid(sessionId, 'sessionId');
        const assetsDir = resolveWithin(getProjectsDir(), id, 'assets');
        if (!existsSync(assetsDir)) return { success: true, assets: [] };

        try {
            const entries = await readdir(assetsDir, { withFileTypes: true });
            const assets = [];
            for (const entry of entries) {
                if (entry.isFile()) {
                    const fullPath = join(assetsDir, entry.name);
                    let st;
                    try { st = await stat(fullPath); } catch { st = null; }
                    const ext = entry.name.split('.').pop()?.toLowerCase();
                    const typeMap: Record<string, string> = { png: 'image', jpg: 'image', svg: 'svg', pdf: 'pdf' };
                    assets.push({
                        name: entry.name,
                        path: join('assets', entry.name),
                        type: typeMap[ext || ''] || 'other',
                        size: st?.size || 0,
                        created: st?.birthtime ? new Date(st.birthtime).toISOString() : '',
                        modified: st?.mtime ? new Date(st.mtime).toISOString() : '',
                    });
                }
            }
            return { success: true, assets };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    });
}
