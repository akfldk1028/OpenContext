import { ChildProcess } from "child_process";
import { updateServerRunningStatus } from "../configLoader";
import { MCPServerConfig, ServerStatus } from "../types/server-status";
import { IMCPServer } from "../types/server-status";
import {BrowserWindow} from "electron";

export abstract class BaseMCPServer implements IMCPServer {
    name: string;
    config: MCPServerConfig;
    status: 'stopped' | 'running' | 'error' = 'stopped';
    public processHandle: ChildProcess | null = null;

    constructor(name: string, config: MCPServerConfig) {
      this.name = name;
      this.config = config;
    }

    public logInfo(message: string): void {
      console.log(`[${this.name}] ${message}`);

      // 메인 윈도우가 있으면 로그 이벤트 전송
      const mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
      if (mainWindow) {
        mainWindow.webContents.send('server-log', `ℹ️ [${this.name}] ${message}`);
      }
    }

    public logError(message: string, error?: any): void {
      console.error(`[${this.name}] ${message}`, error || '');

      // 에러 메시지도 전송
      const mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
      if (mainWindow) {
        const errorMsg = error ? `: ${error instanceof Error ? error.message : String(error)}` : '';
        mainWindow.webContents.send('server-log', `❌ [${this.name}] ${message}${errorMsg}`);
      }
    }

    updateStatus(newStatus: 'stopped' | 'running' | 'error'): void {
      this.status = newStatus;
      updateServerRunningStatus(this.name, newStatus === 'running');
      this.logInfo(`상태 변경: ${newStatus}`);
    }

    abstract start(): Promise<void>;
    abstract stop(): Promise<void>;
    abstract checkStatus(): Promise<ServerStatus>;
  }
