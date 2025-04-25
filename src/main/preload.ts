import { ServerStatus } from '@/common/types/server-status';
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels =
  | 'ipc-example'
  | 'startServer'
  | 'stopServer'
  | 'getServers'
  | 'getConfigSummaries'
  | 'serversUpdated'
  | 'installServer'
  | 'installResult'
  | 'installProgress'
  | 'uninstallServer'
  | 'uninstallResult'
  | 'uninstallProgress'
  | 'server-start-result'
  | 'server-stop-result'
  | 'server-log'
  | 'connect-to-claude'
  | 'disconnect-from-claude'
  | 'is-connected-to-claude'
  | 'get-claude-connected-servers'
  | 'ask-claude-connection'
  | 'confirm-claude-connection'
  | 'claude-connection-result';

// Low‑level façade (you can remove this if you don't need it elsewhere)
const electronHandler = {
  sendMessage: (channel: Channels, ...args: unknown[]) => ipcRenderer.send(channel, ...args),
  on: (channel: Channels, func: (...args: unknown[]) => void) => {
    const listener = (_: IpcRendererEvent, ...args: unknown[]) => func(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  once: (channel: Channels, func: (...args: unknown[]) => void) =>
    ipcRenderer.once(channel, (_: IpcRendererEvent, ...args: unknown[]) => func(...args)),
  invoke: (channel: Channels, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
};

// High‑level API
const api = {
  // Servers
  getServers:        ()                => electronHandler.invoke('getServers') as Promise<any[]>,
  getConfigSummaries:()                => electronHandler.invoke('getConfigSummaries') as Promise<any[]>,
  // onServersUpdated:  (fn: (list: any[]) => void) => electronHandler.on('serversUpdated', (_, list) => fn(list as any[])),
  onServersUpdated:  (fn: (list: ServerStatus[]) => void) => electronHandler.on('serversUpdated', (statuses) => fn(statuses as ServerStatus[])),

  // High‑level API 객체 내에 다음 코드 추가
  onServerStartResult: (fn: (result: any) => void) => {
    const listener = (_: IpcRendererEvent, res: any) => fn(res);
    ipcRenderer.on('server-start-result', listener);
    return () => {
      ipcRenderer.removeListener('server-start-result', listener);
    };
  },

  onServerStopResult: (fn: (result: any) => void) => {
    const listener = (_: IpcRendererEvent, res: any) => fn(res);
    ipcRenderer.on('server-stop-result', listener);
    return () => {
      ipcRenderer.removeListener('server-stop-result', listener);
    };
  },

  // 여기에 onServerLog 추가
onServerLog: (fn: (message: string) => void) => {
  const listener = (_: IpcRendererEvent, message: string) => fn(message);
  ipcRenderer.on('server-log', listener);
  return () => {
    ipcRenderer.removeListener('server-log', listener);
  };
},

  // Control
  startServer: (serverName: string) => ipcRenderer.send('start-server', serverName), // <-- 이 부분 확인/추가
  stopServer:  (serverName: string) => ipcRenderer.send('stop-server', serverName), // <-- 이 부분 확인/추가

  // Install
  installServer:     (name: string) => {
    console.log('⏩ preload: send installServer', name);
    electronHandler.sendMessage('installServer', name);
  },
  onInstallProgress: (fn: (progress: any) => void) => {
    // 1) 리스너 함수 정의
    const listener = (_: IpcRendererEvent, p: any) => fn(p);
    // 2) 등록
    ipcRenderer.on('installProgress', listener);
    // 3) 해제함수 반환
    return () => {
      ipcRenderer.removeListener('installProgress', listener);
    };
  },
  onInstallResult: (fn: (result: any) => void) => {
    const listener = (_: IpcRendererEvent, res: any) => fn(res);
    ipcRenderer.on('installResult', listener);
    return () => {
      ipcRenderer.removeListener('installResult', listener);
    };
  },

  // Uninstall
  uninstallServer:     (name: string) => electronHandler.sendMessage('uninstallServer', name),

  onUninstallProgress: (fn: (progress: any) => void) => {
    const listener = (_: IpcRendererEvent, p: any) => fn(p);
    ipcRenderer.on('uninstallProgress', listener);
    return () => {
      ipcRenderer.removeListener('uninstallProgress', listener);
    };
  },

  // 제거 결과 구독
  onUninstallResult: (fn: (result: any) => void) => {
    const listener = (_: IpcRendererEvent, res: any) => fn(res);
    ipcRenderer.on('uninstallResult', listener);
    return () => {
      ipcRenderer.removeListener('uninstallResult', listener);
    };
  },
  // Claude Desktop 연동
  connectToClaudeDesktop: (serverName: string) =>
    electronHandler.invoke('connect-to-claude', serverName),

  disconnectFromClaudeDesktop: (serverName: string) =>
    electronHandler.invoke('disconnect-from-claude', serverName),

  isConnectedToClaudeDesktop: (serverName: string) =>
    electronHandler.invoke('is-connected-to-claude', serverName),

  getClaudeConnectedServers: () =>
    electronHandler.invoke('get-claude-connected-servers'),

  onAskClaudeConnection: (fn: (data: {serverName: string, serverConfig: any}) => void) => {
    return electronHandler.on('ask-claude-connection', fn);
  },

  confirmClaudeConnection: (serverName: string, connect: boolean) => {
    electronHandler.sendMessage('confirm-claude-connection', { serverName, connect });
  },

  onClaudeConnectionResult: (fn: (result: any) => void) => {
    return electronHandler.on('claude-connection-result', fn);
  },


};

contextBridge.exposeInMainWorld('electron', electronHandler);
contextBridge.exposeInMainWorld('api', api);

export type ElectronHandler = typeof electronHandler;
export type Api             = typeof api;


