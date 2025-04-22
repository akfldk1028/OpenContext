// src/common/configLoader.ts
import { MCPServer, LocalMCPServer, RemoteMCPServer, MCPServerConfig } from './models/mcpserver';
import mcpConfig from './config/mcpServer.json';  // ← 이 경로가 맞는지 꼭 확인

/**
 * mcpConfig.mcpServers 의 타입은
 * Record<string, { command: string; args: string[]; env?: Record<string,string>; host?: string; port?: number }>
 * 로 인식됩니다.
 */
export function loadMCPServers(): Map<string, MCPServer> {
  const serversMap = new Map<string, MCPServer>();

  for (const [name, srv] of Object.entries(mcpConfig.mcpServers) as [string, MCPServerConfig][]) {
    const cfg: MCPServerConfig = {
      command: srv.command,
      args:    srv.args,
      env:     srv.env,
      host:    srv.host,
      port:    srv.port,
    };

    const instance = (cfg.host && cfg.port)
      ? new RemoteMCPServer(name, cfg)
      : new LocalMCPServer(name, cfg);

    serversMap.set(name, instance);
  }

  return serversMap;
}
