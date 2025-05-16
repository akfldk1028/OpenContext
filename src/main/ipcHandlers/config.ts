import { ipcMain } from 'electron';
import {getBaseMCPServerConfig, getMCPConfigSummaryList, getMCPServerConfig} from '@/common/configLoader';
import logger from '../util';

export function registerConfigIpcHandlers() {
  ipcMain.handle('getConfigSummaries', () => {
    logger.info('✨ Fetching config summaries');
    return getMCPConfigSummaryList();
  });

  ipcMain.handle('getBaseConfig', (_, name: string) => {
    logger.info(`✨ Fetching base config: ${name}`);
    return getBaseMCPServerConfig(name);
  });
}
