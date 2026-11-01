/**
 * Granted filesystem roots.
 *
 * The renderer never gets an unrestricted path. Every fs:* IPC call must resolve
 * inside either the projects directory or a folder the user explicitly opened
 * through a native dialog this session.
 *
 * Grants are deliberately in-memory: they must not be writable through the
 * settings IPC, otherwise a compromised renderer could simply grant itself "/".
 */
import path from 'path';
import { realpath } from 'fs/promises';
import { getProjectsDir } from './projects';

const grantedRoots = new Set<string>();

const MAX_SYMLINK_WALK = 40;

async function realpathOrNull(target: string): Promise<string | null> {
    try {
        return await realpath(target);
    } catch {
        return null;
    }
}

/** Register a folder the user picked in a native dialog. */
export async function addGrantedRoot(folder: string): Promise<string> {
    const resolved = await realpathOrNull(path.resolve(folder));
    if (!resolved) throw new Error('Folder does not exist');
    grantedRoots.add(resolved);
    return resolved;
}

/** Roots currently allowed: the projects dir plus dialog-granted folders. */
export async function listGrantedRoots(): Promise<string[]> {
    const roots = new Set<string>();
    const projects = await realpathOrNull(getProjectsDir());
    if (projects) roots.add(projects);
    for (const root of grantedRoots) roots.add(root);
    return [...roots];
}

function isWithin(root: string, target: string): boolean {
    const rel = path.relative(root, target);
    return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}

/**
 * Real path of a target that may not exist yet.
 * Resolves the nearest existing ancestor through realpath, then re-appends the
 * missing tail, so `writeFile` to a new file still gets symlink-escape checking.
 */
async function resolveForCheck(target: string): Promise<string | null> {
    const absolute = path.resolve(target);
    const existing = await realpathOrNull(absolute);
    if (existing) return existing;

    let dir = path.dirname(absolute);
    const tail: string[] = [path.basename(absolute)];

    for (let i = 0; i < MAX_SYMLINK_WALK; i++) {
        const resolvedDir = await realpathOrNull(dir);
        if (resolvedDir) return path.join(resolvedDir, ...tail.reverse());
        tail.push(path.basename(dir));
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return null;
}

/**
 * Throw unless `target` resolves inside a granted root.
 * Returns the resolved absolute path to use for the actual filesystem call.
 */
export async function assertGrantedPath(target: string): Promise<string> {
    if (typeof target !== 'string' || !target.trim()) throw new Error('Invalid path');
    if (target.includes('\0')) throw new Error('Invalid path');

    const resolved = await resolveForCheck(target);
    if (!resolved) throw new Error('Invalid path');

    for (const root of await listGrantedRoots()) {
        if (isWithin(root, resolved)) return resolved;
    }
    throw new Error('Path is outside the folders this app has permission to access');
}
