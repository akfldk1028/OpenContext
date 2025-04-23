import { BaseMCPServer } from './BaseMCPServer';
import { ServerStatus } from '../types/server-status';
import { NetworkUtils } from '../utils/NetworkUtils';

export class RemoteMCPServer extends BaseMCPServer {
  async start(): Promise<void> {
    // 원격 서버는 실제 시작보다 연결 상태 업데이트만 수행
    this.logInfo('원격 서버 연결 시작');
    this.updateStatus('running');
  }
  
  async stop(): Promise<void> {
    // 원격 서버는 실제 종료보다 연결 상태 업데이트만 수행
    this.logInfo('원격 서버 연결 종료');
    this.updateStatus('stopped');
  }
  
  async checkStatus(): Promise<ServerStatus> {
    this.logInfo('원격 서버 상태 확인 중...');
    const host = this.config.host || 'localhost';
    const port = this.config.port;
    let online = false;
    
    try {
      if (port) {
        online = await NetworkUtils.checkPortOpen(host, port);
        this.logInfo(`포트 확인 결과: ${online ? '연결됨' : '연결 안됨'}`);
      } else {
        online = await NetworkUtils.pingHost(host);
        this.logInfo(`호스트 ping 결과: ${online ? '응답' : '무응답'}`);
      }
      
      // 상태 동기화
      this.syncStatusWithConnectionCheck(online);
      
      return { name: this.name, online };
    } catch (error) {
      this.logError('상태 확인 중 오류 발생', error);
        
      if (this.status === 'running') {
        this.updateStatus('error');
      }
      
      return { name: this.name, online: false };
    }
  }
  
  private syncStatusWithConnectionCheck(isConnected: boolean): void {
    const wasRunning = this.status === 'running';
    
    if (isConnected && !wasRunning) {
      this.updateStatus('running');
    } else if (!isConnected && wasRunning) {
      this.updateStatus('stopped');
    }
  }
}