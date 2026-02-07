/**
 * File system IPC handlers
 */
import { ipcMain, dialog, BrowserWindow } from 'electron';
import { join } from 'path';
import { readdir, readFile, writeFile, unlink, rename } from 'fs/promises';

export function registerFsHandlers(getMainWindow: () => BrowserWindow | null) {
    ipcMain.handle('fs:openFolder', async () => {
        const mainWindow = getMainWindow();
        if (!mainWindow) return null;
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
        });
        return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handle('fs:readDirectory', async (_, path: string) => {
        const entries = await readdir(path, { withFileTypes: true });
        return entries.map((entry) => ({
            name: entry.name,
            path: join(path, entry.name),
            type: entry.isDirectory() ? 'directory' : 'file',
        }));
    });

    ipcMain.handle('fs:readFile', async (_, path: string) => {
        return readFile(path, 'utf-8');
    });

    ipcMain.handle('fs:writeFile', async (_, path: string, content: string) => {
        await writeFile(path, content, 'utf-8');
    });

    ipcMain.handle('fs:createFile', async (_, path: string) => {
        await writeFile(path, '', 'utf-8');
    });

    ipcMain.handle('fs:deleteFile', async (_, path: string) => {
        await unlink(path);
    });

    ipcMain.handle('fs:renameFile', async (_, oldPath: string, newPath: string) => {
        await rename(oldPath, newPath);
    });

    ipcMain.handle('fs:writeBinaryFile', async (_, path: string, base64Data: string) => {
        const buffer = Buffer.from(base64Data, 'base64');
        await writeFile(path, new Uint8Array(buffer));
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
        return result.canceled ? null : result.filePath;
    });
}
