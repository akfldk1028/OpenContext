// process/ProcessManager.ts
import { ChildProcess, spawn } from 'child_process';
import { ServerStatus } from '../types/server-status';
import { BaseMCPServer } from './BaseMCPServer';

export class ProcessManager {
  private server: BaseMCPServer;

  constructor(server: BaseMCPServer) {
    this.server = server;
  }

  spawnProcess(command: string, args: string[], env: NodeJS.ProcessEnv): ChildProcess {
    const proc = spawn(command, args, {
      env,
      stdio: 'pipe',
      detached: true
    });

    this.setupProcessEventHandlers(proc);
    return proc;
  }

  setupProcessEventHandlers(proc: ChildProcess): void {
    proc.on('exit', (code) => {
      if (code !== 0) {
        this.server.logError(`프로세스가 비정상 종료됨 (코드: ${code})`);
        this.server.updateStatus('error');
      } else {
        this.server.logInfo('프로세스가 정상 종료됨');
        this.server.updateStatus('stopped');
      }
      this.server.processHandle = null;
    });

    proc.on('error', (err) => {
      this.server.logError('프로세스 오류 발생', err);
      this.server.updateStatus('error');
      this.server.processHandle = null;
    });
  }

  killProcess(proc: ChildProcess): void {
    if (!proc) return;

    this.server.logInfo(`프로세스 핸들 종료 시도 (PID: ${proc.pid})`);
    const killed = proc.kill('SIGKILL');
    this.server.logInfo(`종료 신호 전송 결과: ${killed ? '성공' : '실패'}`);
  }

  checkProcessStatus(): ServerStatus {
    this.server.logInfo('포트 정보 없음, 프로세스 핸들로 상태 확인');
    const isRunning = Boolean(this.server.processHandle && !this.server.processHandle.killed);
    return { name: this.server.name, online: isRunning };
  }
}
