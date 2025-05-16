// LocalMCPServer.ts
import { ChildProcess, spawn } from 'child_process';
import { BaseMCPServer } from './BaseMCPServer';
import { MCPServerConfig, ServerStatus } from '../types/server-status';
import { ProcessManager } from './ProcessManager';
import { SSEConnectionChecker } from './network/SSEConnectionChecker';
import { PortConnectionChecker } from './network/PortConnectionChecker';

export class LocalMCPServer extends BaseMCPServer {
  private processManager: ProcessManager;

  private sseChecker: SSEConnectionChecker;

  private portChecker: PortConnectionChecker;

  constructor(name: string, config: MCPServerConfig) {
    super(name, config);
    this.processManager = new ProcessManager(this);
    this.sseChecker = new SSEConnectionChecker(this);
    this.portChecker = new PortConnectionChecker(this);
  }

  async start(): Promise<void> {
    try {
      this.logInfo('서버 시작 중...');
      this.logInfo(`명령어: ${this.config.command}`);
      this.logInfo(`인자: ${JSON.stringify(this.config.args)}`);

      this.processHandle = this.processManager.spawnProcess(
        this.config.command,
        this.config.args,
        { ...process.env, ...this.config.env },
      );

      this.updateStatus('running');
    } catch (err) {
      this.logError('서버 시작 실패', err);
      this.updateStatus('error');
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.logInfo('서버 중지 중...');

    try {
      const sseEndpoint = this.findSSEEndpoint();

      if (sseEndpoint) {
        await this.sseChecker.stopSSEServer(sseEndpoint);
      } else if (this.config.port) {
        await this.portChecker.stopServerByPort(this.processHandle);
      } else if (this.processHandle) {
        this.processManager.killProcess(this.processHandle);
        this.processHandle = null;
      }

      this.updateStatus('stopped');
    } catch (error) {
      this.logError('서버 중지 중 오류 발생', error);
      this.updateStatus('stopped');
    }
  }

  async checkStatus(): Promise<ServerStatus> {
    this.logInfo('상태 확인 중...');

    // 1. SSE 엔드포인트 확인
    const sseEndpoint = this.findSSEEndpoint();
    if (sseEndpoint) {
      return await this.sseChecker.checkSSEStatus(sseEndpoint);
    }

    // 2. 포트 확인
    if (this.config.port) {
      return await this.portChecker.checkPortStatus();
    }

    // 3. 프로세스 핸들만 확인
    return this.processManager.checkProcessStatus();
  }

  // 유틸리티 메서드
  private findSSEEndpoint(): string | null {
    if (!this.config.args || this.config.args.length === 0) return null;

    for (let i = 0; i < this.config.args.length - 1; i++) {
      if (this.config.args[i] === '--sse') {
        return this.config.args[i + 1];
      }
    }
    return null;
  }
}
