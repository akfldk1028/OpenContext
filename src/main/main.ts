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
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { spawn } from 'child_process';
import { ServerManager } from '../common/manager/severManager';

import { loadMCPServers } from '../common/configLoader';
import { ServerInstaller } from '../common/installer/ServerInstaller';
import { ServerUninstaller } from '../common/installer/ServerUninstaller';
import { MCPServerConfigExtended } from '@/common/types/server-config';

// 인스톨러 및 언인스톨러 인스턴스 생성
const installer = new ServerInstaller();
const uninstaller = new ServerUninstaller();

const isDev = process.env.NODE_ENV === 'development';
const serversMap = loadMCPServers();
const manager    = new ServerManager(Array.from(serversMap.values()))


// 설치 진행 상태 이벤트 전달
installer.addProgressListener((progress) => {
  if (mainWindow) {
    mainWindow.webContents.send('installProgress', progress);
  }
});

uninstaller.addProgressListener((progress) => {
  if (mainWindow) {
    mainWindow.webContents.send('uninstallProgress', progress);
  }
});

// 서버 설치 IPC 핸들러
ipcMain.on('installServer', async (event, serverName: string) => {
  const config = mcpConfig.mcpServers[serverName] as MCPServerConfigExtended;
  
  if (!config) {
    event.reply('installResult', { 
      success: false, 
      serverName, 
      message: '서버 설정을 찾을 수 없습니다' 
    });
    return;
  }
  
  try {
    const success = await installer.installServer(serverName, config);
    
    event.reply('installResult', { 
      success, 
      serverName, 
      message: success ? '설치 완료' : '설치 실패' 
    });
    
    // 설치 성공 시 서버 목록 갱신
    if (success) {
      event.sender.send('serversUpdated', manager.getStatus());
    }
  } catch (error) {
    event.reply('installResult', { 
      success: false, 
      serverName, 
      message: `설치 오류: ${error instanceof Error ? error.message : String(error)}` 
    });
  }
});

// 서버 제거 IPC 핸들러
ipcMain.on('uninstallServer', async (event, serverName: string) => {
  const config = mcpConfig.mcpServers[serverName] as MCPServerConfigExtended;
  
  if (!config) {
    event.reply('uninstallResult', { 
      success: false, 
      serverName, 
      message: '서버 설정을 찾을 수 없습니다' 
    });
    return;
  }
  
  try {
    // 먼저 서버 중지
    await manager.stopServer(serverName);
    
    // 서버 제거
    const success = await uninstaller.uninstallServer(serverName, config);
    
    event.reply('uninstallResult', { 
      success, 
      serverName, 
      message: success ? '제거 완료' : '제거 실패' 
    });
    
    // 제거 성공 시 서버 목록 갱신
    if (success) {
      event.sender.send('serversUpdated', manager.getStatus());
    }
  } catch (error) {
    event.reply('uninstallResult', { 
      success: false, 
      serverName, 
      message: `제거 오류: ${error instanceof Error ? error.message : String(error)}` 
    });
  }
});


class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;















ipcMain.handle('getServers', async () => {
  return manager.getStatus();  // 서버들의 최신 상태 리스트 반환
});
ipcMain.on('startServer', async (event, serverName: string) => {
  await manager.startServer(serverName);
  // 옵션: 서버 시작 후 상태 변화가 있으므로, 전체 상태를 다시 전송
  event.sender.send('serversUpdated', manager.getStatus());
});
ipcMain.on('stopServer', async (event, serverName: string) => {
  await manager.stopServer(serverName);
  event.sender.send('serversUpdated', manager.getStatus());
});


// setInterval(async () => {
//   for (const srv of manager.getAllServers()) {
//     const statusInfo = await srv.checkStatus();
//     // srv 객체 내부에 상태 캐시를 업데이트하거나 srv.status 갱신
//   }
//   // 모든 상태 업데이트 후 렌더러에 전달
//   mainWindow.webContents.send('serversUpdated', manager.getStatus());
// }, 5000);



ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

// 비개발자를 위한 MCP 서버 실행 처리 핸들러
// ipcMain.on('start-server', (_, serverId) => {
//   const mcpServers = (servers as any).mcpServers;
//   const cfg = mcpServers ? mcpServers[serverId] : null;
//   if (!cfg) {
//     console.error(`서버 설정을 찾을 수 없습니다: ${serverId}`);
//     return;
//   }
//   const proc = spawn(cfg.command, cfg.args || [], { detached: true, stdio: 'ignore' });
//   proc.unref();
// });

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
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
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
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
