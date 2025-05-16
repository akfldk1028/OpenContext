import { ServerManager } from '../common/manager/severManager';
import { loadMCPServers } from '../common/configLoader';

console.log(`[managerInstance] 초기화 시작`);
const serversMap = loadMCPServers();
export const manager = new ServerManager(Array.from(serversMap.values()));
console.log(`[managerInstance] 초기화 완료`);
