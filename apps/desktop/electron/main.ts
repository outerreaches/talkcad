/**
 * TalkCAD Desktop - Main Process
 * App lifecycle, window management, and menu only.
 * IPC handlers are modularized in ./ipc/
 */
import { app, BrowserWindow, Menu, session, shell } from 'electron';
import { fileURLToPath } from 'url';
import { join, sep } from 'path';
import { registerAllHandlers, detectOpenSCAD } from './ipc';
import { ensureBundledLibraries } from './lib/assets';
import { createElectronSecretCodec } from './lib/secrets';
import { hasSecretCodec, loadConfig, saveConfig, setSecretCodec } from './config';

let mainWindow: BrowserWindow | null = null;

/** Files the renderer is allowed to navigate to: the built app, or the dev server. */
function isInternalUrl(target: string): boolean {
  try {
    const url = new URL(target);
    const devServer = process.env.VITE_DEV_SERVER_URL;
    if (devServer) {
      if (url.origin === new URL(devServer).origin) return true;
    }
    if (url.protocol !== 'file:') return false;
    const appRoot = join(__dirname, '..') + sep;
    return fileURLToPath(url).startsWith(appRoot);
  } catch {
    return false;
  }
}

function openExternalSafely(target: string): void {
  try {
    const url = new URL(target);
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      void shell.openExternal(url.toString());
    }
  } catch {
    /* ignore malformed URLs */
  }
}

/** Harden every web contents: no stray navigation, no popups, no permissions. */
function hardenWebContents(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event, target) => {
      if (!isInternalUrl(target)) {
        event.preventDefault();
        openExternalSafely(target);
      }
    });

    contents.setWindowOpenHandler(({ url }) => {
      openExternalSafely(url);
      return { action: 'deny' };
    });

    contents.on('will-attach-webview', (event) => {
      event.preventDefault();
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Export STL...',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => mainWindow?.webContents.send('menu:exportSTL'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/** Move a plaintext API key in config.json into OS-backed encrypted storage. */
async function migratePlaintextSecret(): Promise<void> {
  if (!hasSecretCodec()) return;
  const userData = app.getPath('userData');
  try {
    const config = await loadConfig(userData);
    if (config.llm.apiKey && !config.llm.apiKeyEnc) {
      await saveConfig(config, userData);
    }
  } catch (error) {
    console.error('[Config] Secret migration failed:', error);
  }
}

// App lifecycle
app.whenReady().then(async () => {
  setSecretCodec(await createElectronSecretCodec());
  await migratePlaintextSecret();

  hardenWebContents();

  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);

  await detectOpenSCAD();
  await ensureBundledLibraries();
  registerAllHandlers(() => mainWindow);
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
