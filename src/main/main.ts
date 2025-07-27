/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { promises as fs } from 'fs';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { ConfigIpcHandlers } from './configIpc';
import { StorageIpcHandlers } from './storageIpc';
import { RecordingIpcHandlers } from './recordingIpc';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;
let configIpcHandlers: ConfigIpcHandlers | null = null;
let storageIpcHandlers: StorageIpcHandlers | null = null;
let recordingIpcHandlers: RecordingIpcHandlers | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

// Application state IPC handlers
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:getPlatform', () => {
  return process.platform;
});

ipcMain.handle('app:isPackaged', () => {
  return app.isPackaged;
});

ipcMain.handle('app:getPath', (_, name: string) => {
  return app.getPath(name as any);
});

// File system IPC handlers
ipcMain.handle('fs:exists', async (_, filePath: string) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('fs:isDirectory', async (_, filePath: string) => {
  try {
    const stats = await fs.stat(filePath);
    return stats.isDirectory();
  } catch {
    return false;
  }
});

ipcMain.handle('fs:createDirectory', async (_, dirPath: string) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error('Error creating directory:', error);
    throw error;
  }
});

ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
});

ipcMain.handle('fs:writeFile', async (_, filePath: string, data: Buffer) => {
  try {
    await fs.writeFile(filePath, data);
  } catch (error) {
    console.error('Error writing file:', error);
    throw error;
  }
});

ipcMain.handle('fs:deleteFile', async (_, filePath: string) => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
});

ipcMain.handle('fs:getStats', async (_, filePath: string) => {
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      isDirectory: stats.isDirectory(),
      modified: stats.mtime,
    };
  } catch (error) {
    console.error('Error getting file stats:', error);
    throw error;
  }
});

// Window management IPC handlers
ipcMain.handle('window:minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window:close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.handle('window:setFullScreen', (_, fullscreen: boolean) => {
  if (mainWindow) {
    mainWindow.setFullScreen(fullscreen);
  }
});

ipcMain.handle('window:isFullScreen', () => {
  return mainWindow ? mainWindow.isFullScreen() : false;
});

// Notification IPC handlers
ipcMain.handle('notification:show', (_, options: { title: string; body: string }) => {
  if (mainWindow) {
    mainWindow.webContents.send('notification:show', options);
  }
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug').default();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: getAssetPath('icon.png'),
    titleBarStyle: 'default',
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,

      webSecurity: true,
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevent the app from being suspended while recording
  mainWindow.on('blur', () => {
    // Keep the app active even when not focused
    if (mainWindow) {
      mainWindow.webContents.send('app:focus-changed', false);
    }
  });

  mainWindow.on('focus', () => {
    if (mainWindow) {
      mainWindow.webContents.send('app:focus-changed', true);
    }
  });

  // Handle app suspension/resume for recording continuity
  app.on('before-quit', (event) => {
    // Allow the renderer to clean up recording state
    if (mainWindow && !mainWindow.isDestroyed()) {
      event.preventDefault();
      mainWindow.webContents.send('app:before-quit');

      // Give the renderer time to clean up, then quit
      setTimeout(() => {
        app.quit();
      }, 1000);
    }
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Clean up IPC handlers
  if (configIpcHandlers) {
    configIpcHandlers.removeHandlers();
    configIpcHandlers = null;
  }

  if (storageIpcHandlers) {
    storageIpcHandlers.removeHandlers();
    storageIpcHandlers = null;
  }

  if (recordingIpcHandlers) {
    recordingIpcHandlers.removeHandlers();
    recordingIpcHandlers = null;
  }

  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    // Initialize all IPC handlers
    configIpcHandlers = new ConfigIpcHandlers();
    storageIpcHandlers = new StorageIpcHandlers();
    recordingIpcHandlers = new RecordingIpcHandlers();

    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
