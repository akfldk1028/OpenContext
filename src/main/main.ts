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
import { app, BrowserWindow, shell, ipcMain, IpcMainEvent } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { spawn } from 'child_process';
import { ServerManager } from '../common/manager/severManager';
import { loadMCPServers, getBaseMCPServerConfig, getMCPConfigSummaryList } from '../common/configLoader';
import { ServerInstaller } from '../common/installer/ServerInstaller';
import { ServerUninstaller } from '../common/installer/ServerUninstaller';
import { MCPServerConfigExtended } from '@/common/types/server-config';

// 인스톨러 및 언인스톨러 인스턴스 생성
const installer = new ServerInstaller();
const uninstaller = new ServerUninstaller();

const isDev = process.env.NODE_ENV === 'development';
const serversMap = loadMCPServers();
console.log(`[Main] Initializing ServerManager with serversMap:`, serversMap);
let manager = new ServerManager(Array.from(serversMap.values()));
console.log(`[Main] Initial manager status:`, manager.getStatus());


let mainWindow: BrowserWindow | null = null;
// src/main/main.ts에 추가

import { ClaudeDesktopIntegration } from '../common/integration/ClaudeDesktopIntegration';
import { getMCPServerConfig } from '../common/configLoader';

// Claude Desktop 통합 객체 생성
const claudeIntegration = new ClaudeDesktopIntegration();

// IPC 핸들러 등록
ipcMain.handle('connect-to-claude', async (event, serverName: string) => {
  try {
    // 서버 설정 가져오기
    const serverConfig = getMCPServerConfig(serverName);

    if (!serverConfig) {
      console.error(`[Main] 서버 설정을 찾을 수 없습니다: ${serverName}`);
      return { success: false, message: '서버 설정을 찾을 수 없습니다.' };
    }

    // 설치되지 않은 서버 확인
    if (!serverConfig.isInstalled) {
      console.error(`[Main] 서버가 설치되지 않았습니다: ${serverName}`);
      return { success: false, message: '서버가 설치되지 않았습니다. 먼저 서버를 설치해주세요.' };
    }

    // Claude Desktop에 연결
    const success = claudeIntegration.connectServer(serverName, serverConfig);

    console.log(`[Main] ${serverName} Claude Desktop 연결 결과: ${success ? '성공' : '실패'}`);

    return {
      success,
      message: success
        ? `서버 ${serverName}가 Claude Desktop에 연결되었습니다.`
        : `서버 ${serverName}를 Claude Desktop에 연결하는 데 실패했습니다.`
    };
  } catch (error) {
    console.error(`[Main] Claude Desktop 연결 중 오류 발생:`, error);
    return {
      success: false,
      message: `오류 발생: ${error instanceof Error ? error.message : String(error)}`
    };
  }
});

// main.ts에서 disconnect-from-claude 핸들러 수정

ipcMain.handle('disconnect-from-claude', async (event, serverName: string) => {
  try {
    console.log(`[Main] Claude Desktop 연결 해제 시작: ${serverName}`);
    const isConnected = claudeIntegration.isServerConnected(serverName);
    console.log(`[Main] 현재 Claude Desktop 연결 상태: ${isConnected ? '연결됨' : '연결안됨'}`);

    const success = claudeIntegration.disconnectServer(serverName);

    console.log(`[Main] ${serverName} Claude Desktop 연결 해제 결과: ${success ? '성공' : '실패'}`);
    console.log(`[Main] 연결 해제 후 상태: ${claudeIntegration.isServerConnected(serverName) ? '여전히 연결됨(문제!)' : '연결 해제됨(정상)'}`);

    return {
      success,
      message: success
        ? `서버 ${serverName}가 Claude Desktop에서 연결 해제되었습니다.`
        : `서버 ${serverName}를 Claude Desktop에서 연결 해제하는 데 실패했습니다.`
    };
  } catch (error) {
    console.error(`[Main] Claude Desktop 연결 해제 중 오류 발생:`, error);
    return {
      success: false,
      message: `오류 발생: ${error instanceof Error ? error.message : String(error)}`
    };
  }
});

ipcMain.handle('is-connected-to-claude', async (event, serverName: string) => {
  try {
    return claudeIntegration.isServerConnected(serverName);
  } catch (error) {
    console.error(`[Main] Claude Desktop 연결 상태 확인 중 오류 발생:`, error);
    return false;
  }
});

ipcMain.handle('get-claude-connected-servers', async () => {
  try {
    return claudeIntegration.getAllConnectedServers();
  } catch (error) {
    console.error(`[Main] Claude Desktop 연결 서버 목록 조회 중 오류 발생:`, error);
    return [];
  }
});



// Progress listeners
installer.addProgressListener((progress) => {
  console.log('🔄 main: sending installProgress', progress);
  if (mainWindow) {
    mainWindow.webContents.send('installProgress', progress);
  }
});
uninstaller.addProgressListener((progress) => {
  console.log('🔄 main: sending uninstallProgress', progress);
  if (mainWindow) {
    mainWindow.webContents.send('uninstallProgress', progress);
  }
});

// 서버 설치 IPC 핸들러
ipcMain.on('installServer', async (event: IpcMainEvent, serverName: string) => {
  const config = getBaseMCPServerConfig(serverName);
  console.log('⬇️ main: installServer handler received for', serverName);

  console.log(`[Main] Received BASE config for ${serverName}:`, JSON.stringify(config, null, 2));

  if (!config) {
    console.error(`[Main] Base config not found for ${serverName}. Replying error.`);
    event.reply('installResult', {
      success: false,
      serverName,
      message: `기본 설정 파일(${serverName}.json)을 찾을 수 없습니다.`
    });
    return;
  }

  if (!config.installationMethods || Object.keys(config.installationMethods).length === 0) {
    console.error(`[Main] Critical: installationMethods missing or empty in BASE config for ${serverName}!`);
    event.reply('installResult', {
      success: false,
      serverName,
      message: `설정 파일에 설치 방법(installationMethods)이 정의되지 않았습니다: ${serverName}`
    });
    return;
  }

  try {
    console.log(`[Main] Starting installation process for ${serverName} using BASE config...`);
    const installResult = await installer.installServer(serverName, config);
    console.log(`[Main] Install attempt finished for ${serverName}. Success: ${installResult.success}`);

    if (installResult.success && installResult.method) {
      console.log(`[Main] Install successful. Updating ServerManager for ${serverName} with method: ${installResult.method.type}`);
      manager.updateServerExecutionDetails(serverName, installResult.method);
      console.log(`[Main] ServerManager updated for ${serverName}.`);
    } else if (installResult.success) {
      console.warn(`[Main] Install successful for ${serverName}, but no specific method details received to update ServerManager.`);
    } else {
      console.error(`[Main] Installation failed for ${serverName}.`);
    }

    const message = installResult.success ? '설치 완료' : '설치 실패 (오류 발생)';
    console.log(`[Main] Sending 'installResult' to renderer for ${serverName}: success=${installResult.success}`);
    event.reply('installResult', {
      success: installResult.success,
      serverName,
      message: message,
    });

    if (installResult.success) {
      const newMap = loadMCPServers();
      manager = new ServerManager(Array.from(newMap.values()));
      event.sender.send('serversUpdated', manager.getStatus());


      event.reply('ask-claude-connection', {
      serverName,
      serverConfig: getMCPServerConfig(serverName)
      });
    }

  } catch (error) {
    console.error(`[Main] Error during install process for ${serverName}:`, error);
    event.reply('installResult', {
      success: false,
      serverName,
      message: `설치 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

ipcMain.on('confirm-claude-connection', async (event, { serverName, connect }) => {
  if (connect) {
    const serverConfig = getMCPServerConfig(serverName);
    if (serverConfig) {
      const success = claudeIntegration.connectServer(serverName, serverConfig);
      event.reply('claude-connection-result', {
        serverName,
        success,
        message: success
          ? `${serverName} 서버가 Claude Desktop에 연결되었습니다.`
          : `${serverName} 서버를 Claude Desktop에 연결하는 데 실패했습니다.`
      });
    }
  }
});
// 서버 제거 IPC 핸들러
ipcMain.on('uninstallServer', async (event: IpcMainEvent, serverName: string) => {
  console.log(`🗑️ main: uninstallServer handler received for ${serverName}`);
  const config = getBaseMCPServerConfig(serverName);

  if (!config) {
    console.error(`[Main] Config not found for ${serverName}. Cannot uninstall.`);
    event.reply('uninstallResult', {
      success: false,
      serverName,
      message: `설정 파일을 찾을 수 없어 제거할 수 없습니다: ${serverName}`
    });
    return;
  }

  try {
    await manager.stopServer(serverName);
    console.log(`[Main] Attempting to uninstall server ${serverName}...`);

    const success = await uninstaller.uninstallServer(serverName, config);
    console.log(`[Main] Uninstall attempt for ${serverName} finished. Success: ${success}`);

    const message = success ? '제거 완료' : '제거 실패';
    event.reply('uninstallResult', {
      success,
      serverName,
      message
    });

    if (success) {
      const newMap = loadMCPServers();
      manager = new ServerManager(Array.from(newMap.values()));
      console.log(`[Main] ServerManager updated after uninstalling ${serverName}.`);
      event.sender.send('serversUpdated', manager.getStatus());
    }
  } catch (error) {
    console.error(`[Main] Error during uninstall process for ${serverName}:`, error);
    event.reply('uninstallResult', {
      success: false,
      serverName,
      message: `제거 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

// 서버 시작 IPC 핸들러 - 이벤트 이름 확인
ipcMain.on('start-server', async (event: IpcMainEvent, serverName: string) => {
  console.log(`[Main] Received start-server IPC for: ${serverName}`);
  try {
    console.log(`[Main] Attempting to start server ${serverName} via ServerManager...`);
    await manager.startServer(serverName);
    console.log(`[Main] Server ${serverName} start command issued successfully.`);
    // 응답 이벤트 이름이 preload.ts의 함수와 일치하는지 확인
    event.reply('server-start-result', { success: true, serverName });
    event.sender.send('serversUpdated', manager.getStatus());
  } catch (error) {
    console.error(`[Main] Failed to start server ${serverName}:`, error);
    event.reply('server-start-result', { success: false, serverName, error: error instanceof Error ? error.message : String(error) });
  }
});

// 서버 중지 IPC 핸들러 - 이벤트 이름 확인
ipcMain.on('stop-server', async (event: IpcMainEvent, serverName: string) => {
  console.log(`[Main] Received stop-server IPC for: ${serverName}`);
  try {
    console.log(`[Main] Attempting to stop server ${serverName} via ServerManager...`);
    await manager.stopServer(serverName);
    console.log(`[Main] Server ${serverName} stop command issued successfully.`);
    // 응답 이벤트 이름이 preload.ts의 함수와 일치하는지 확인
    event.reply('server-stop-result', { success: true, serverName });
    event.sender.send('serversUpdated', manager.getStatus());
  } catch (error) {
    console.error(`[Main] Failed to stop server ${serverName}:`, error);
    event.reply('server-stop-result', { success: false, serverName, error: error instanceof Error ? error.message : String(error) });
  }
});


class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

// IPC 핸들러 for getting server statuses
ipcMain.handle('getServers', async () => {
  console.log('[Main] Handling getServers request.');
  return manager.getStatus();
});

// Config summaries IPC handler
ipcMain.handle('getConfigSummaries', async () => {
  console.log('[Main] Handling getConfigSummaries request.');
  return getMCPConfigSummaryList();
});

ipcMain.on('ipc-example', async (event: IpcMainEvent, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
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

setInterval(async () => {
  if (!mainWindow) return;
  const statuses = await manager.updateStatuses();
  console.log(`[Main] Sending serversUpdated event with data:`, JSON.stringify(statuses));
  mainWindow.webContents.send('serversUpdated', statuses);
}, 5000);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    const canAccessFiles = claudeIntegration.testFileAccess();
    console.log(`[Main] 파일 접근 테스트 결과: ${canAccessFiles ? '성공' : '실패'}`);

    createWindow();

    app.on('activate', () => {
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);


function sendServerLogToRenderer(message: string) {
  if (mainWindow) {
    mainWindow.webContents.send('server-log', message);
  }
}


export { sendServerLogToRenderer };
