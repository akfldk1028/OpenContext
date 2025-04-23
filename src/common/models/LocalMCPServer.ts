import { ChildProcess, spawn, execSync } from 'child_process';
import { BaseMCPServer } from './BaseMCPServer';
import { ServerStatus } from '../types/server-status';
import { NetworkUtils } from '../utils/NetworkUtils';

export class LocalMCPServer extends BaseMCPServer {
  async start(): Promise<void> {
    try {
      this.logInfo('서버 시작 중...');
      this.logInfo(`명령어: ${this.config.command}`);
      this.logInfo(`인자: ${JSON.stringify(this.config.args)}`);
      
      const combinedEnv = { ...process.env, ...this.config.env };
      
      this.processHandle = spawn(
        this.config.command,
        this.config.args,
        {
          env: combinedEnv,
          stdio: 'pipe',
          detached: true
        }
      );
      // console.log(this.processHandle);
      // 프로세스 종료 시 상태 업데이트
      this.processHandle.on('exit', (code) => {
        if (code !== 0) {
          this.logError(`프로세스가 비정상 종료됨 (코드: ${code})`);
          this.updateStatus('error');
        } else {
          this.logInfo('프로세스가 정상 종료됨');
          this.updateStatus('stopped');
        }
        this.processHandle = null;
      });
      
      // 프로세스 오류 시 상태 업데이트
      this.processHandle.on('error', (err) => {
        this.logError('프로세스 오류 발생', err);
        this.updateStatus('error');
        this.processHandle = null;
      });
      
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
      // 1. 포트 기반 프로세스 종료 (더 안정적)
      if (this.config.port) {
        await this.killProcessByPort();
      }
      
      // 2. 프로세스 핸들로 종료 시도
      if (this.processHandle) {
        this.killProcessHandle();
      }
      
      // 3. 상태 업데이트
      this.updateStatus('stopped');
      
      // 4. 포트 종료 확인
      if (this.config.port) {
        await this.verifyPortClosed();
      }
    } catch (error) {
      this.logError('서버 중지 중 오류 발생', error);
      // 오류가 발생해도 상태는 업데이트
      this.updateStatus('stopped');
    }
  }
  
  async checkStatus(): Promise<ServerStatus> {
    this.logInfo('상태 확인 중...');
    
    // 포트가 없으면 프로세스 핸들로 확인 (덜 정확)
    if (!this.config.port) {
      this.logInfo('포트 정보 없음, 프로세스 핸들로 상태 확인');
      const isRunning = Boolean(this.processHandle && !this.processHandle.killed);
      return { name: this.name, online: isRunning };
    }
    
    // 포트로 상태 확인 (더 정확)
    try {
      const isPortOpen = await NetworkUtils.checkPortOpen(
        this.config.host || 'localhost', 
        this.config.port
      );
      
      this.logInfo(`포트 ${this.config.port} 상태: ${isPortOpen ? '열림' : '닫힘'}`);
      
      // 상태 동기화
      this.syncStatusWithPortCheck(isPortOpen);
      
      return { name: this.name, online: isPortOpen };
    } catch (error) {
      this.logError('포트 확인 중 오류 발생', error);
      
      if (this.status === 'running') {
        this.updateStatus('error');
      }
      
      return { name: this.name, online: false };
    }
  }
  
  private async killProcessByPort(): Promise<void> {
    if (!this.config.port) return;
    
    this.logInfo(`포트 ${this.config.port}의 프로세스 종료 시도`);
    
    try {
      if (process.platform === 'win32') {
        // Windows
        execSync(
          `for /f "tokens=5" %a in ('netstat -ano ^| find ":${this.config.port}" ^| find "LISTENING"') do taskkill /F /PID %a`,
          { stdio: 'inherit' }
        );
      } else {
        // Unix/Linux/MacOS
        execSync(
          `lsof -ti:${this.config.port} | xargs -r kill -9`,
          { stdio: 'inherit' }
        );
      }
    } catch (e) {
      this.logInfo(`포트 ${this.config.port}에서 실행 중인 프로세스를 찾을 수 없거나 종료 실패`);
    }
  }
  
  private killProcessHandle(): void {
    if (!this.processHandle) return;
    
    this.logInfo(`프로세스 핸들 종료 시도 (PID: ${this.processHandle.pid})`);
    const killed = this.processHandle.kill('SIGKILL');
    this.logInfo(`종료 신호 전송 결과: ${killed ? '성공' : '실패'}`);
    this.processHandle = null;
  }
  
  private async verifyPortClosed(): Promise<void> {
    if (!this.config.port) return;
    
    let attempts = 0;
    const maxAttempts = 3;
    const retryDelayMs = 500;
    
    while (attempts < maxAttempts) {
      try {
        const stillOpen = await NetworkUtils.checkPortOpen(
          this.config.host || 'localhost',
          this.config.port
        );
        
        if (!stillOpen) {
          this.logInfo(`포트 ${this.config.port} 닫힘 확인, 서버 정상 종료됨`);
          break;
        }
        
        this.logInfo(`포트 ${this.config.port} 아직 열려있음, 재시도 대기 중...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        attempts++;
      } catch (error) {
        break; // 오류 발생 시 체크 중단
      }
    }
    
    if (attempts >= maxAttempts) {
      this.logError(`포트 ${this.config.port}가 여러 번의 종료 시도 후에도 사용 중일 수 있음`);
    }
  }
  
  private syncStatusWithPortCheck(isPortOpen: boolean): void {
    if (isPortOpen && this.status !== 'running') {
      this.updateStatus('running');
    } else if (!isPortOpen && this.status === 'running') {
      this.updateStatus('stopped');
      if (this.processHandle) {
        this.processHandle = null;
      }
    }
  }
}