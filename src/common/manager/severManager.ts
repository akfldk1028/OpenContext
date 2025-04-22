import { MCPServer, ServerStatus } from '../models/mcpserver';

export class ServerManager {
    private servers: Map<string, MCPServer>;
    constructor(serverList: MCPServer[]) {
      this.servers = new Map(serverList.map(s => [s.name, s]));
    }
    getStatus(): ServerStatus[] {
        return Array.from(this.servers.values()).map(srv => ({
            name: srv.name,
            status: srv.status,
            online: srv.status === 'running',
            pingMs: srv.status === 'running' ? 0 : undefined,
          }));
        }
    async startServer(name: string): Promise<void> {
      const srv = this.servers.get(name);
      if (!srv) return;
      if (srv.status !== 'running') {
        await srv.start();
      }
    }
    async stopServer(name: string): Promise<void> {
      const srv = this.servers.get(name);
      if (!srv) return;
      if (srv.status === 'running') {
        await srv.stop();
      }
    }
    // ... etc.
  }
  