// src/common/configLoader.ts
import { MCPServer, LocalMCPServer, RemoteMCPServer } from './models/mcpserver';
import { MCPConfig, MCPServerConfigExtended } from './types/server-config';
import raw from './config/mcpServer.json';   // <<— webpack will bundle this

const mcpConfig = raw as MCPConfig;

export function loadMCPServers(): Map<string, MCPServer> {
  const map = new Map<string, MCPServer>();
  for (const [name, srvCfg] of Object.entries(mcpConfig.mcpServers)) {
    const method = srvCfg.installationMethods[srvCfg.defaultMethod!];
    const cfg = {
      command: method.command,
      args:    method.args,
      env:     method.env,
      host:    srvCfg.host,
      port:    srvCfg.port,
    };
    const inst = cfg.host && cfg.host !== 'localhost'
      ? new RemoteMCPServer(name, cfg)
      : new LocalMCPServer(name, cfg);
    map.set(name, inst);
  }
  return map;
}

export function getMCPServerConfig(name: string): MCPServerConfigExtended | undefined {
  return mcpConfig.mcpServers[name];
}
