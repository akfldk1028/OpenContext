// src/common/models/ServerStatus.ts
export interface ServerStatus {
    name: string;
    online: boolean;
    pingMs?: number;
  }
  
  // src/common/models/IMCPServer.ts
  export interface IMCPServer {
    name: string;
    status: 'stopped' | 'running' | 'error';
    start(): Promise<void>;
    stop(): Promise<void>;
    checkStatus(): Promise<ServerStatus>;
  }
  
  // src/common/models/MCPServerConfig.ts
  export interface MCPServerConfig {
    command: string;
    args: string[];
    env?: { [key: string]: string };
    host?: string;
    port?: number;
  }