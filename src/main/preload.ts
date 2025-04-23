import { ServerStatus } from '@/common/models/mcpserver';
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels =
  | 'ipc-example'
  | 'startServer'
  | 'stopServer'
  | 'getServers'
  | 'serversUpdated'
  | 'installServer'
  | 'installResult'
  | 'installProgress'
  | 'uninstallServer'
  | 'uninstallResult'
  | 'uninstallProgress'
  | 'server-start-result'
  | 'server-stop-result';


// Low‑level façade (you can remove this if you don’t need it elsewhere)
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

};

contextBridge.exposeInMainWorld('electron', electronHandler);
contextBridge.exposeInMainWorld('api', api);

export type ElectronHandler = typeof electronHandler;
export type Api             = typeof api;


// // Disable no-unused-vars, broken for spread args
// /* eslint no-unused-vars: off */
// import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// export type Channels = 'ipc-example' | 'start-server';

// const electronHandler = {
//   ipcRenderer: {
//     sendMessage(channel: Channels, ...args: unknown[]) {
//       ipcRenderer.send(channel, ...args);
//     },
//     on(channel: Channels, func: (...args: unknown[]) => void) {
//       const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
//         func(...args);
//       ipcRenderer.on(channel, subscription);

//       return () => {
//         ipcRenderer.removeListener(channel, subscription);
//       };
//     },
//     once(channel: Channels, func: (...args: unknown[]) => void) {
//       ipcRenderer.once(channel, (_event, ...args) => func(...args));
//     },
//   },
// };

// contextBridge.exposeInMainWorld('electron', electronHandler);

// export type ElectronHandler = typeof electronHandler;
