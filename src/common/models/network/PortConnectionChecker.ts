// network/PortConnectionChecker.ts
import { execSync } from 'child_process';
import { ChildProcess } from 'child_process';
import { ServerStatus } from '../../types/server-status';
import { NetworkUtils } from '../../utils/NetworkUtils';
import { BaseMCPServer } from '../BaseMCPServer';
import { ResourceVerifier } from './ResourceVerifier';

export class PortConnectionChecker {
  private server: BaseMCPServer;
  private resourceVerifier: ResourceVerifier;
  
  constructor(server: BaseMCPServer) {
    this.server = server;
    this.resourceVerifier = new ResourceVerifier(server);
  }

  async checkPortStatus(): Promise<ServerStatus> {
    try {
      const isPortOpen = await NetworkUtils.checkPortOpen(
        this.server.config.host || 'localhost',
        this.server.config.port!
      );

      this.server.logInfo(`포트 ${this.server.config.port} 상태: ${isPortOpen ? '열림' : '닫힘'}`);
      this.syncStatusWithPortCheck(isPortOpen);
      return { name: this.server.name, online: isPortOpen };
    } catch (error) {
      this.server.logError('포트 확인 중 오류 발생', error);
      if (this.server.status === 'running') {
        this.server.updateStatus('error');
      }
      return { name: this.server.name, online: false };
    }
  }

  async stopServerByPort(processHandle: ChildProcess | null): Promise<void> {
    await this.killProcessByPort();

    if (processHandle) {
      this.server.logInfo(`프로세스 핸들 종료 시도 (PID: ${processHandle.pid})`);
      const killed = processHandle.kill('SIGKILL');
      this.server.logInfo(`종료 신호 전송 결과: ${killed ? '성공' : '실패'}`);
      this.server.processHandle = null;
    }

    await this.verifyPortClosed();
  }

  async killProcessByPort(): Promise<void> {
    if (!this.server.config.port) return;

    this.server.logInfo(`포트 ${this.server.config.port}의 프로세스 종료 시도`);

    try {
      if (process.platform === 'win32') {
        execSync(
          `for /f "tokens=5" %a in ('netstat -ano ^| find ":${this.server.config.port}" ^| find "LISTENING"') do taskkill /F /PID %a`,
          { stdio: 'inherit' }
        );
      } else {
        execSync(
          `lsof -ti:${this.server.config.port} | xargs -r kill -9`,
          { stdio: 'inherit' }
        );
      }
    } catch (e) {
      this.server.logInfo(`포트 ${this.server.config.port}에서 실행 중인 프로세스를 찾을 수 없거나 종료 실패`);
    }
  }

  async verifyPortClosed(): Promise<void> {
    if (!this.server.config.port) return;

    await this.resourceVerifier.verifyResourceClosed(
      async () => await NetworkUtils.checkPortOpen(
        this.server.config.host || 'localhost',
        this.server.config.port!
      ),
      `포트 ${this.server.config.port}`,
      `포트 ${this.server.config.port}가 여러 번의 종료 시도 후에도 사용 중일 수 있음`
    );
  }

  private syncStatusWithPortCheck(isPortOpen: boolean): void {
    if (isPortOpen && this.server.status !== 'running') {
      this.server.updateStatus('running');
    } else if (!isPortOpen && this.server.status === 'running') {
      this.server.updateStatus('stopped');
      if (this.server.processHandle) {
        this.server.processHandle = null;
      }
    }
  }
}
