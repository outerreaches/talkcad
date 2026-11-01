/**
 * File system IPC handlers.
 *
 * Every path is resolved through `assertGrantedPath` before touching disk:
 * only the projects directory and folders the user opened with a native dialog
 * are reachable from the renderer.
 */
import { ipcMain, dialog, BrowserWindow } from 'electron';
import { dirname, join } from 'path';
import { readdir, readFile, writeFile, unlink, rename } from 'fs/promises';
import { addGrantedRoot, assertGrantedPath } from '../lib/grants';

export function registerFsHandlers(getMainWindow: () => BrowserWindow | null) {
    ipcMain.handle('fs:openFolder', async () => {
        const mainWindow = getMainWindow();
        if (!mainWindow) return null;
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
        });
        if (result.canceled || !result.filePaths[0]) return null;
        // The user picked this folder: it becomes a root for this session.
        return addGrantedRoot(result.filePaths[0]);
    });

    ipcMain.handle('fs:readDirectory', async (_, path: string) => {
        const safePath = await assertGrantedPath(path);
        const entries = await readdir(safePath, { withFileTypes: true });
        return entries.map((entry) => ({
            name: entry.name,
            path: join(safePath, entry.name),
            type: entry.isDirectory() ? 'directory' : 'file',
        }));
    });

    ipcMain.handle('fs:readFile', async (_, path: string) => {
        const safePath = await assertGrantedPath(path);
        return readFile(safePath, 'utf-8');
    });

    ipcMain.handle('fs:writeFile', async (_, path: string, content: string) => {
        const safePath = await assertGrantedPath(path);
        await writeFile(safePath, content, 'utf-8');
    });

    ipcMain.handle('fs:createFile', async (_, path: string) => {
        const safePath = await assertGrantedPath(path);
        await writeFile(safePath, '', 'utf-8');
    });

    ipcMain.handle('fs:deleteFile', async (_, path: string) => {
        const safePath = await assertGrantedPath(path);
        await unlink(safePath);
    });

    ipcMain.handle('fs:renameFile', async (_, oldPath: string, newPath: string) => {
        const safeOld = await assertGrantedPath(oldPath);
        const safeNew = await assertGrantedPath(newPath);
        await rename(safeOld, safeNew);
    });

    ipcMain.handle('fs:writeBinaryFile', async (_, path: string, base64Data: string) => {
        const safePath = await assertGrantedPath(path);
        const buffer = Buffer.from(base64Data, 'base64');
        await writeFile(safePath, new Uint8Array(buffer));
    });

    ipcMain.handle('dialog:saveFile', async (_, options: {
        title?: string;
        defaultPath?: string;
        filters?: { name: string; extensions: string[] }[]
    }) => {
        const mainWindow = getMainWindow();
        if (!mainWindow) return null;
        const result = await dialog.showSaveDialog(mainWindow, {
            title: options.title || 'Save File',
            defaultPath: options.defaultPath,
            filters: options.filters || [],
        });
        if (result.canceled || !result.filePath) return null;
        // Grant the chosen folder so the follow-up write passes the check.
        await addGrantedRoot(dirname(result.filePath));
        return result.filePath;
    });
}
