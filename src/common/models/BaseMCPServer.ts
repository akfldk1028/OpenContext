import { ChildProcess } from "child_process";
import { updateServerRunningStatus } from "../configLoader";
import { MCPServerConfig, ServerStatus } from "../types/server-status";
import { IMCPServer } from "../types/server-status";

export abstract class BaseMCPServer implements IMCPServer {
    name: string;
    config: MCPServerConfig;
    status: 'stopped' | 'running' | 'error' = 'stopped';
    protected processHandle: ChildProcess | null = null;
    
    constructor(name: string, config: MCPServerConfig) {
      this.name = name;
      this.config = config;
    }
    
    protected logInfo(message: string): void {
      console.log(`[${this.name}] ${message}`);
    }
    
    protected logError(message: string, error?: any): void {
      console.error(`[${this.name}] ${message}`, error || '');
    }
    
    protected updateStatus(newStatus: 'stopped' | 'running' | 'error'): void {
      this.status = newStatus;
      updateServerRunningStatus(this.name, newStatus === 'running');
      this.logInfo(`상태 변경: ${newStatus}`);
    }
    
    abstract start(): Promise<void>;
    abstract stop(): Promise<void>;
    abstract checkStatus(): Promise<ServerStatus>;
  }