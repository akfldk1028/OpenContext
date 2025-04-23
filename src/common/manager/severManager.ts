import { LocalMCPServer} from '../models/LocalMCPServer';
import { RemoteMCPServer } from '../models/RemoteMCPServer';
import { ServerStatus } from '../types/server-status';
import { ServerInstallationMethod } from '../types/server-config';
import { BaseMCPServer } from '../models/BaseMCPServer';

export class ServerManager {
    private servers: Map<string, BaseMCPServer>;
    constructor(serverList: BaseMCPServer[]) {
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
    async updateStatuses(): Promise<ServerStatus[]> {
        const statuses: ServerStatus[] = [];
        for (const srv of this.servers.values()) {
          try {
            const stat = await srv.checkStatus();
            // also mirror it into srv.status if you like:
            srv.status = stat.online ? 'running' : 'stopped';
            statuses.push({ ...stat });
          } catch {
            srv.status = 'error';
            statuses.push({ name: srv.name, online: false });
          }
        }
        return statuses;
      }

      updateServerExecutionDetails(serverName: string, method: ServerInstallationMethod): void {
        const srv = this.servers.get(serverName);
        if (srv) {
          // JSON 설정에서 command/args를 가져와 MCPServer 인스턴스의 config를 업데이트
          const jsonCommand = method.command; // 예: 'uvx'
          const jsonArgs = method.args;       // 예: ['mcp-server-qdrant', '--transport', 'sse']

          console.log(`[Manager] Updating execution details for ${serverName}: Command=${jsonCommand}, Args=${JSON.stringify(jsonArgs)}`);

          // LocalMCPServer 또는 MCPServer의 config 객체 직접 수정
          srv.config.command = jsonCommand;
          srv.config.args = jsonArgs;

          // Docker나 다른 타입에 따라 필요한 환경변수 등도 여기서 업데이트 가능
          // 예: if (method.type === 'docker') { srv.config.port = config.port; ... }
        } else {
          console.error(`[Manager] Cannot update details: Server ${serverName} not found.`);
        }
      } 
    // ... etc.
  }
  