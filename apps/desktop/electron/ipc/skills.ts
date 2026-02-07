/**
 * Skills database IPC handlers
 */
import { ipcMain, app } from 'electron';
import { join, basename, relative, dirname } from 'path';
import { existsSync } from 'fs';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { getProjectsDir } from '../lib/projects';
import { assertUuid, resolveWithin, sanitizePathSegment } from '../lib/safe-path';

// Resolve skills directory (bundled or dev fallback)
function resolveBuiltinSkillsDir(): string | null {
    const directCandidates = [
        join(app.getAppPath(), 'assets', 'skills'),
        join(process.resourcesPath, 'assets', 'skills'),
    ];
    for (const p of directCandidates) {
        if (existsSync(p)) return p;
    }

    // Dev fallback: search upwards for resources/skills
    const starts = [app.getAppPath(), process.cwd()];
    for (const start of starts) {
        let dir = start;
        for (let i = 0; i < 8; i++) {
            const repoSkills = join(dir, 'resources', 'skills');
            if (existsSync(repoSkills)) return repoSkills;
            const desktopSkills = join(dir, 'apps', 'desktop', 'assets', 'skills');
            if (existsSync(desktopSkills)) return desktopSkills;
            const parent = dirname(dir);
            if (parent === dir) break;
            dir = parent;
        }
    }
    return null;
}

function getUserSkillsDir(): string {
    // Persist user-created skills in a writable location.
    return join(app.getPath('userData'), 'skills');
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
    const out: string[] = [];
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...(await listMarkdownFiles(fullPath)));
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
            out.push(fullPath);
        }
    }
    return out;
}

function extractTitle(content: string, fallback: string): string {
    const lines = content.split('\n');
    for (const line of lines) {
        const m = line.match(/^#\s+(.+)\s*$/);
        if (m?.[1]) return m[1].trim();
    }
    return fallback;
}

function parseTags(content: string): string[] {
    const frontmatter = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontmatter) return [];
    const tags = frontmatter[1].match(/tags:\s*\[([^\]]*)\]/);
    if (!tags) return [];
    return tags[1].split(',').map(t => t.trim().toLowerCase().replace(/['"]/g, '')).filter(Boolean);
}

function getBody(content: string): string {
    return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '').trim();
}

function decodeSkillPath(path: string): { source: 'builtin' | 'user'; relPath: string } {
    const p = (path || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (p.startsWith('user/')) return { source: 'user', relPath: p.slice('user/'.length) };
    if (p.startsWith('builtin/')) return { source: 'builtin', relPath: p.slice('builtin/'.length) };
    // Back-compat: older stored paths are treated as builtin-relative.
    return { source: 'builtin', relPath: p };
}

function encodeSkillPath(source: 'builtin' | 'user', relPath: string): string {
    const clean = (relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    return `${source}/${clean}`;
}

export function registerSkillsHandlers() {
    ipcMain.handle('skills:search', async (_, args: { query: string; category?: string }) => {
        const builtinDir = resolveBuiltinSkillsDir();
        const userDir = getUserSkillsDir();
        const sources: Array<{ source: 'builtin' | 'user'; dir: string }> = [];
        if (builtinDir && existsSync(builtinDir)) sources.push({ source: 'builtin', dir: builtinDir });
        if (existsSync(userDir)) sources.push({ source: 'user', dir: userDir });
        if (sources.length === 0) return [];

        const query = (args.query || '').trim().toLowerCase();
        if (!query) return [];

        const tokens = query.split(/\s+/).filter(Boolean);
        const categoryFilter = args.category?.toLowerCase();
        const scored: Array<{ score: number; skill: { title: string; tags: string[]; preview: string; path: string; source: string } }> = [];

        for (const src of sources) {
            const files = await listMarkdownFiles(src.dir);
            for (const filePath of files) {
                let content = '';
                try { content = await readFile(filePath, 'utf-8'); } catch { continue; }

                const tags = parseTags(content);
                const body = getBody(content);
                const title = extractTitle(body, basename(filePath));
                const rel = relative(src.dir, filePath);

                let score = 0;
                for (const t of tokens) {
                    if (tags.some(tag => tag === t || tag.includes(t))) score += 3;
                    if (title.toLowerCase().includes(t)) score += 2;
                    if (body.toLowerCase().includes(t)) score += 1;
                }
                if (categoryFilter && tags.some(tag => tag.includes(categoryFilter) || categoryFilter.includes(tag))) {
                    score += 2;
                }
                if (score < Math.ceil(tokens.length * 0.5)) continue;

                const preview = body.replace(/```[\s\S]*?```/g, '').slice(0, 300);
                scored.push({
                    score,
                    skill: {
                        title,
                        tags,
                        preview: preview.length >= 300 ? preview + '...' : preview,
                        path: encodeSkillPath(src.source, rel),
                        source: src.source,
                    },
                });
            }
        }

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, 3).map(x => x.skill);
    });

    ipcMain.handle('skills:getFull', async (_, args: { path: string; sessionId?: string }) => {
        const decoded = decodeSkillPath(args.path);
        const baseDir = decoded.source === 'user' ? getUserSkillsDir() : resolveBuiltinSkillsDir();
        if (!baseDir) return null;

        let fullPath: string;
        try {
            fullPath = resolveWithin(baseDir, decoded.relPath);
        } catch {
            return null;
        }
        if (!existsSync(fullPath)) return null;

        try {
            const content = await readFile(fullPath, 'utf-8');
            const body = getBody(content);
            const title = extractTitle(body, basename(fullPath));
            const tags = parseTags(content);

            // Check for associated schematic
            const baseName = fullPath.replace(/\.md$/, '');
            let schematic: { type: 'svg' | 'png'; path: string } | undefined;
            const svgPath = baseName + '.svg';
            const pngPath = baseName + '.png';
            const schematicSource = existsSync(svgPath) ? svgPath : existsSync(pngPath) ? pngPath : null;

            if (schematicSource && args.sessionId) {
                let assetsDir: string;
                try {
                    const sid = assertUuid(args.sessionId, 'sessionId');
                    assetsDir = resolveWithin(getProjectsDir(), sid, 'assets');
                } catch {
                    assetsDir = '';
                }
                try {
                    if (!assetsDir) throw new Error('Invalid sessionId');
                    await mkdir(assetsDir, { recursive: true });
                    const ext = schematicSource.endsWith('.svg') ? 'svg' : 'png';
                    const name = decoded.relPath.replace(/\.md$/, '').replace(/\//g, '-') + '.' + ext;
                    const destPath = join(assetsDir, name);
                    const fileContent = await readFile(schematicSource);
                    await writeFile(destPath, new Uint8Array(fileContent));
                    schematic = { type: ext, path: destPath };
                } catch (e) {
                    console.warn('Failed to copy schematic:', e);
                }
            }

            return { title, tags, content: body, path: args.path, source: decoded.source, schematic };
        } catch { return null; }
    });

    ipcMain.handle('skills:create', async (_, args: {
        title: string; tags: string[]; content: string; category?: string; schematicBase64?: string; update?: boolean;
    }) => {
        const category = sanitizePathSegment(args.category || 'learned', 'learned');
        const baseDir = getUserSkillsDir();
        const categoryDir = join(baseDir, category);
        try { await mkdir(categoryDir, { recursive: true }); } catch { /* dir may exist */ }

        const filename = args.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) + '.md';
        const filePath = join(categoryDir, filename);
        const relativePath = join(category, filename);
        const exists = existsSync(filePath);

        if (exists && !args.update) {
            return { success: false, error: 'Skill already exists. Use update=true.', path: relativePath };
        }

        let schematicRef = '';
        if (args.schematicBase64) {
            const imgName = args.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50) + '.png';
            try {
                await writeFile(join(categoryDir, imgName), new Uint8Array(Buffer.from(args.schematicBase64, 'base64')));
                schematicRef = `\n\n![Schematic](./${imgName})\n`;
            } catch { /* schematic save optional */ }
        }

        const tagsStr = args.tags.map(t => t.toLowerCase().replace(/[^a-z0-9-]/g, '')).join(', ');
        const skillContent = `---\ntags: [${tagsStr}]\n---\n# ${args.title}\n\n${args.content}${schematicRef}\n`;

        try {
            await writeFile(filePath, skillContent, 'utf-8');
            return { success: true, path: encodeSkillPath('user', relativePath), message: exists ? `Updated: ${args.title}` : `Saved: ${args.title}`, updated: exists };
        } catch (e) {
            return { success: false, error: `Failed: ${String(e)}` };
        }
    });
}
