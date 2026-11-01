import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: () => join(tmpdir(), 'talkcad-unused') },
}));

// Imported after the electron mock is registered.
import { addGrantedRoot, assertGrantedPath } from './grants';

let workDir: string;
let projectsDir: string;
let outsideDir: string;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'talkcad-grants-'));
  projectsDir = join(workDir, 'projects');
  outsideDir = join(workDir, 'outside');
  await mkdir(projectsDir, { recursive: true });
  await mkdir(outsideDir, { recursive: true });
  await writeFile(join(outsideDir, 'secret.txt'), 'top secret');
  process.env.TALKCAD_PROJECTS_DIR = projectsDir;
});

afterAll(async () => {
  delete process.env.TALKCAD_PROJECTS_DIR;
  await rm(workDir, { recursive: true, force: true });
});

describe('assertGrantedPath', () => {
  it('allows paths inside the projects directory', async () => {
    const session = join(projectsDir, 'session-1', 'code.scad');
    await expect(assertGrantedPath(session)).resolves.toContain('session-1');
  });

  it('allows a file that does not exist yet under a granted root', async () => {
    const target = join(projectsDir, 'session-2', 'model.stl');
    await expect(assertGrantedPath(target)).resolves.toContain('session-2');
  });

  it('rejects absolute paths outside the roots', async () => {
    await expect(assertGrantedPath('/etc/passwd')).rejects.toThrow(/outside the folders/);
  });

  it('rejects traversal out of the projects directory', async () => {
    await expect(assertGrantedPath(join(projectsDir, '..', 'outside', 'secret.txt')))
      .rejects.toThrow(/outside the folders/);
  });

  it('rejects a symlink that escapes a granted root', async () => {
    const link = join(projectsDir, 'escape');
    await symlink(outsideDir, link);
    await expect(assertGrantedPath(join(link, 'secret.txt'))).rejects.toThrow(/outside the folders/);
  });

  it('allows a folder after it is granted', async () => {
    await addGrantedRoot(outsideDir);
    await expect(assertGrantedPath(join(outsideDir, 'secret.txt'))).resolves.toContain('secret.txt');
  });

  it('refuses to grant a folder that does not exist', async () => {
    await expect(addGrantedRoot(join(workDir, 'missing'))).rejects.toThrow(/does not exist/);
  });

  it('rejects empty and null-byte paths', async () => {
    await expect(assertGrantedPath('')).rejects.toThrow(/Invalid path/);
    await expect(assertGrantedPath('a\0b')).rejects.toThrow(/Invalid path/);
  });
});
