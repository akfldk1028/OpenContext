import { ipcMain } from 'electron';
import { ClaudeDesktopIntegration } from '@/common/integration/ClaudeDesktopIntegration';
import logger from '../util';
import { getMCPServerConfig } from '@/common/configLoader';

const claude = new ClaudeDesktopIntegration();

export function registerClaudeIpcHandlers() {
  ipcMain.handle('connect-to-claude', async (_, name: string) => {
    logger.info(`🔄 Attempting connect-to-claude: ${name}`);
    const cfg = getMCPServerConfig(name);
    if (!cfg || !cfg.isInstalled) {
      logger.warn(`⚠️ Cannot connect, server not installed: ${name}`);
      return { success: false, message: '서버가 설치되지 않았습니다.' };
    }
    const ok = claude.connectServer(name, cfg);
    logger.info(ok ? `✅ Connected to Claude: ${name}` : `❌ Failed to connect to Claude: ${name}`);
    return { success: ok };
  });

  ipcMain.handle('disconnect-from-claude', async (_, name: string) => {
    logger.info(`🔄 Disconnecting from Claude: ${name}`);
    const ok = claude.disconnectServer(name);
    logger.info(ok ? `✅ Disconnected: ${name}` : `❌ Disconnect failed: ${name}`);
    return { success: ok };
  });

  ipcMain.handle('is-connected-to-claude', (_, name: string) => {
    const status = claude.isServerConnected(name);
    logger.info(`ℹ️ is-connected-to-claude (${name}): ${status}`);
    return status;
  });

  ipcMain.handle('get-claude-connected-servers', () => {
    const list = claude.getAllConnectedServers();
    logger.info(`⚡ get-claude-connected-servers: [${list.join(', ')}]`);
    return list;
  });
}
