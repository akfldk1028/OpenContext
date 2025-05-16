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
import { spawn } from 'child_process';
import { MCPServerConfigExtended } from '@/common/types/server-config';
import MenuBuilder from './menu';
import logger, { resolveHtmlPath } from './util';
import { ServerManager } from '../common/manager/severManager';
import {
  loadMCPServers,
  getBaseMCPServerConfig,
  getMCPConfigSummaryList,
  getMCPServerConfig,
} from '../common/configLoader';
import { ServerInstaller } from '../common/installer/ServerInstaller';
import { ServerUninstaller } from '../common/installer/ServerUninstaller';
import { registerClaudeIpcHandlers } from './ipcHandlers/claude';
import { setMainWindow } from './managers/ServerManagerWrapper';
import { startExpressServer } from './expressServer';
import { preloadMetadataForServer } from './preloadMetadata'; // ✨ 추가
import { manager } from './managerInstance';
import { ClaudeDesktopIntegration } from '../common/integration/ClaudeDesktopIntegration';

const serversMap = loadMCPServers();

// 인스톨러 및 언인스톨러 인스턴스 생성
const installer = new ServerInstaller();
const uninstaller = new ServerUninstaller();



console.log(`[Main] Initial manager status:`, manager.getStatus());
console.log(manager.getStatus());

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === 'development';


// Claude Desktop 통합 객체 생성
const claudeIntegration = new ClaudeDesktopIntegration();
// 여기서 가져옴!
console.log(`[Main] Initial manager status:`, manager.getStatus());

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

  console.log(
    `[Main] Received BASE config for ${serverName}:`,
    JSON.stringify(config, null, 2),
  );

  if (!config) {
    console.error(
      `[Main] Base config not found for ${serverName}. Replying error.`,
    );
    event.reply('installResult', {
      success: false,
      serverName,
      message: `기본 설정 파일(${serverName}.json)을 찾을 수 없습니다.`,
    });
    return;
  }

  if (
    !config.installationMethods ||
    Object.keys(config.installationMethods).length === 0
  ) {
    console.error(
      `[Main] Critical: installationMethods missing or empty in BASE config for ${serverName}!`,
    );
    event.reply('installResult', {
      success: false,
      serverName,
      message: `설정 파일에 설치 방법(installationMethods)이 정의되지 않았습니다: ${serverName}`,
    });
    return;
  }

  try {
    console.log(
      `[Main] Starting installation process for ${serverName} using BASE config...`,
    );
    const installResult = await installer.installServer(serverName, config);
    console.log(
      `[Main] Install attempt finished for ${serverName}. Success: ${installResult.success}`,
    );

    if (installResult.success && installResult.method) {
      console.log(
        `[Main] Install successful. Updating ServerManager for ${serverName} with method: ${installResult.method.type}`,
      );
      manager.updateServerExecutionDetails(serverName, installResult.method);
      console.log(`[Main] ServerManager updated for ${serverName}.`);
    } else if (installResult.success) {
      console.warn(
        `[Main] Install successful for ${serverName}, but no specific method details received to update ServerManager.`,
      );
    } else {
      console.error(`[Main] Installation failed for ${serverName}.`);
    }

    const message = installResult.success
      ? '설치 완료'
      : '설치 실패 (오류 발생)';
    console.log(
      `[Main] Sending 'installResult' to renderer for ${serverName}: success=${installResult.success}`,
    );
    event.reply('installResult', {
      success: installResult.success,
      serverName,
      message,
    });

    if (installResult.success) {
      const newMap = loadMCPServers();
      // manager = new ServerManager(Array.from(newMap.values()));
      event.sender.send('serversUpdated', manager.getStatus());

      event.reply('ask-claude-connection', {
        serverName,
        serverConfig: getMCPServerConfig(serverName),
      });
    }
  } catch (error) {
    console.error(
      `[Main] Error during install process for ${serverName}:`,
      error,
    );
    event.reply('installResult', {
      success: false,
      serverName,
      message: `설치 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
});

ipcMain.on(
  'confirm-claude-connection',
  async (event, { serverName, connect }) => {
    if (connect) {
      const serverConfig = getMCPServerConfig(serverName);
      if (serverConfig) {
        const success = claudeIntegration.connectServer(
          serverName,
          serverConfig,
        );
        event.reply('claude-connection-result', {
          serverName,
          success,
          message: success
            ? `${serverName} 서버가 Claude Desktop에 연결되었습니다.`
            : `${serverName} 서버를 Claude Desktop에 연결하는 데 실패했습니다.`,
        });
      }
    }
  },
);
// 서버 제거 IPC 핸들러
ipcMain.on(
  'uninstallServer',
  async (event: IpcMainEvent, serverName: string) => {
    console.log(`🗑️ main: uninstallServer handler received for ${serverName}`);
    const config = getBaseMCPServerConfig(serverName);

    if (!config) {
      console.error(
        `[Main] Config not found for ${serverName}. Cannot uninstall.`,
      );
      event.reply('uninstallResult', {
        success: false,
        serverName,
        message: `설정 파일을 찾을 수 없어 제거할 수 없습니다: ${serverName}`,
      });
      return;
    }

    try {
      await manager.stopServer(serverName);
      console.log(`[Main] Attempting to uninstall server ${serverName}...`);

      const success = await uninstaller.uninstallServer(serverName, config);
      console.log(
        `[Main] Uninstall attempt for ${serverName} finished. Success: ${success}`,
      );

      const message = success ? '제거 완료' : '제거 실패';
      event.reply('uninstallResult', {
        success,
        serverName,
        message,
      });

      if (success) {
        const newMap = loadMCPServers();
        manager = new ServerManager(Array.from(newMap.values()));
        console.log(
          `[Main] ServerManager updated after uninstalling ${serverName}.`,
        );
        event.sender.send('serversUpdated', manager.getStatus());
      }
    } catch (error) {
      console.error(
        `[Main] Error during uninstall process for ${serverName}:`,
        error,
      );
      event.reply('uninstallResult', {
        success: false,
        serverName,
        message: `제거 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  },
);

// 서버 시작 IPC 핸들러 - 이벤트 이름 확인
// 서버 시작 IPC 핸들러
ipcMain.on('start-server', async (event: IpcMainEvent, serverName: string) => {
  try {
    await manager.startServer(serverName);
    await preloadMetadataForServer(serverName); // ✅ 서버 시작하면 preload 다시 호출
    event.reply('server-start-result', { success: true, serverName });
    event.sender.send('serversUpdated', manager.getStatus());
  } catch (error) {
    console.error(`[Main] Failed to start server ${serverName}:`, error);
    event.reply('server-start-result', { success: false, serverName, error: error instanceof Error ? error.message : String(error) });
  }
});

// ipcMain.on('start-server', async (event: IpcMainEvent, serverName: string) => {
//   console.log(`[Main] Received start-server IPC for: ${serverName}`);
//   try {
//     console.log(
//       `[Main] Attempting to start server ${serverName} via ServerManager...`,
//     );
//     await manager.startServer(serverName);
//     console.log(
//       `[Main] Server ${serverName} start command issued successfully.`,
//     );
//     // 응답 이벤트 이름이 preload.ts의 함수와 일치하는지 확인
//     event.reply('server-start-result', { success: true, serverName });
//     event.sender.send('serversUpdated', manager.getStatus());
//   } catch (error) {
//     console.error(`[Main] Failed to start server ${serverName}:`, error);
//     event.reply('server-start-result', {
//       success: false,
//       serverName,
//       error: error instanceof Error ? error.message : String(error),
//     });
//   }
// });

// 서버 중지 IPC 핸들러 - 이벤트 이름 확인
ipcMain.on('stop-server', async (event: IpcMainEvent, serverName: string) => {
  console.log(`[Main] Received stop-server IPC for: ${serverName}`);
  try {
    console.log(
      `[Main] Attempting to stop server ${serverName} via ServerManager...`,
    );
    await manager.stopServer(serverName);
    console.log(
      `[Main] Server ${serverName} stop command issued successfully.`,
    );
    // 응답 이벤트 이름이 preload.ts의 함수와 일치하는지 확인
    event.reply('server-stop-result', { success: true, serverName });
    event.sender.send('serversUpdated', manager.getStatus());
  } catch (error) {
    console.error(`[Main] Failed to stop server ${serverName}:`, error);
    event.reply('server-stop-result', {
      success: false,
      serverName,
      error: error instanceof Error ? error.message : String(error),
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

ipcMain.handle('request-server-metadata', async (event, serverName: string) => {
  const server = manager.getServer(serverName); // 서버 인스턴스 가져옴

  if (!server || !server.processHandle) {
    return { error: '서버가 실행 중이 아니거나 프로세스 핸들이 없습니다.' };
  }

  const proc = server.processHandle;

  try {
    const request = `${JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'get_metadata',
    })}\n`;

    proc.stdin.write(request);

    const response = await new Promise<string>((resolve, reject) => {
      proc.stdout.once('data', (data) => {
        resolve(data.toString());
      });

      setTimeout(() => reject(new Error('Timeout waiting for metadata')), 3000); // 3초 타임아웃
    });

    const metadata = JSON.parse(response);
    return metadata.result;
  } catch (err) {
    console.error('[Main] metadata 요청 중 오류:', err);
    return { error: err instanceof Error ? err.message : String(err) };
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

startExpressServer();

async function createWindow() {
  if (isDev) {
    const installer = require('electron-devtools-installer');
    await installer.default([installer.REACT_DEVELOPER_TOOLS]);
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]) => path.join(RESOURCES_PATH, ...paths);

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      contextIsolation: true,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));
  mainWindow.on('ready-to-show', () => {
    if (mainWindow) mainWindow.show();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  new AppUpdater();
  registerClaudeIpcHandlers();
}

setInterval(async () => {
  if (!mainWindow) return;
  const statuses = await manager.updateStatuses();
  console.log(
    `[Main] Sending serversUpdated event with data:`,
    JSON.stringify(statuses),
  );
  mainWindow.webContents.send('serversUpdated', statuses);
}, 5000);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

async function reattachRunningServers() {
  for (const server of manager.getAllServers()) {
    if (server.status === 'running') {
      console.log(`[Main] 서버 ${server.name}가 실행 중. 프로세스 핸들 attach 및 metadata preload.`);
      await preloadMetadataForServer(server.name); // ✅ metadata preload 호출
    }
  }
}



// 메인 앱 진입
app
  .whenReady()
  .then(async () => {
    const canAccessFiles = claudeIntegration.testFileAccess();
    console.log(`[Main] 파일 접근 테스트 결과: ${canAccessFiles ? '성공' : '실패'}`);
    await reattachRunningServers();  // ✅ 실행중 서버 다시 attach + preload
    await createWindow();
  })
  .catch(console.error);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// app
//   .whenReady()
//   .then(() => {
//     const canAccessFiles = claudeIntegration.testFileAccess();
//     console.log(
//       `[Main] 파일 접근 테스트 결과: ${canAccessFiles ? '성공' : '실패'}`,
//     );
//     reattachRunningServers();
//
//     createWindow();
//     startExpressServer();
//
//     app.on('activate', () => {
//       if (mainWindow === null) createWindow();
//     });
//   })
//   .catch(console.log);

function sendServerLogToRenderer(message: string) {
  if (mainWindow) {
    mainWindow.webContents.send('server-log', message);
  }
}

export { sendServerLogToRenderer };
