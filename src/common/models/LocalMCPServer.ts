import { ChildProcess, spawn, execSync } from 'child_process';
import { BaseMCPServer } from './BaseMCPServer';
import { ServerStatus } from '../types/server-status';
import { NetworkUtils } from '../utils/NetworkUtils';
import * as http from 'http';
import { URL } from 'url';

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
      // 1. SSE 엔드포인트가 있는 경우 SSE 관련 프로세스만 종료
      const sseEndpoint = this.findSSEEndpoint();
      if (sseEndpoint) {
        this.logInfo(`SSE 서버 종료: ${sseEndpoint}`);

        // 프로세스 핸들로 먼저 종료 시도 (SSE 서버가 현재 프로세스인 경우)
        if (this.processHandle) {
          this.logInfo(`프로세스 핸들로 종료 시도 (PID: ${this.processHandle.pid})`);
          const killed = this.processHandle.kill('SIGKILL');
          this.logInfo(`종료 신호 전송 결과: ${killed ? '성공' : '실패'}`);
          this.processHandle = null;
        }

        // SSE 연결이 닫혔는지 확인
        await this.verifySSEClosed(sseEndpoint);
      }
      // SSE가 없으면 일반적인 포트 기반 종료 시도
      else if (this.config.port) {
        await this.killProcessByPort();

        // 프로세스 핸들로 종료 시도
        if (this.processHandle) {
          this.killProcessHandle();
        }

        // 포트 종료 확인
        await this.verifyPortClosed();
      }
      // 둘 다 없으면 프로세스 핸들로만 종료
      else if (this.processHandle) {
        this.killProcessHandle();
      }

      // 상태 업데이트
      this.updateStatus('stopped');
    } catch (error) {
      this.logError('서버 중지 중 오류 발생', error);
      // 오류가 발생해도 상태는 업데이트
      this.updateStatus('stopped');
    }
  }

  async checkStatus(): Promise<ServerStatus> {
    this.logInfo('상태 확인 중...');

    // 1. SSE 엔드포인트 확인 시도 (인자에 --sse가 있는 경우)
    const sseEndpoint = this.findSSEEndpoint();
    if (sseEndpoint) {
      try {
        this.logInfo(`SSE 엔드포인트 감지됨: ${sseEndpoint}, 연결 확인 중...`);
        const isSSEConnected = await this.checkSSEConnection(sseEndpoint);

        if (isSSEConnected) {
          this.logInfo(`SSE 엔드포인트 연결 성공: ${sseEndpoint}`);
          this.updateStatus('running');
          return { name: this.name, online: true };
        } else {
          this.logInfo(`SSE 엔드포인트 연결 실패: ${sseEndpoint}`);
          if (this.status === 'running') {
            this.updateStatus('stopped');
          }
          return { name: this.name, online: false };
        }
      } catch (error) {
        this.logError(`SSE 엔드포인트 확인 중 오류 발생: ${sseEndpoint}`, error);
        if (this.status === 'running') {
          this.updateStatus('error');
        }
        return { name: this.name, online: false };
      }
    }

    // 2. 포트 확인 (기존 로직) - SSE가 없는 경우에만 실행
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

  // SSE 엔드포인트 찾기 (--sse 다음 인자 가져오기)
  private findSSEEndpoint(): string | null {
    if (!this.config.args || this.config.args.length === 0) return null;

    for (let i = 0; i < this.config.args.length - 1; i++) {
      if (this.config.args[i] === '--sse') {
        return this.config.args[i + 1];
      }
    }
    return null;
  }

  // SSE 연결 확인 (HTTP 요청으로 text/event-stream 응답 확인)
  private checkSSEConnection(sseEndpoint: string, timeout: number = 3000): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      try {
        const url = new URL(sseEndpoint);

        const options = {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method: 'GET',
          headers: {
            'Accept': 'text/event-stream'
          },
          timeout: timeout
        };

        const req = http.request(options, (res) => {
          // 상태 코드가 200이고 Content-Type이 text/event-stream 또는 응답이 있으면 성공
          const isEventStream = res.headers['content-type'] &&
                               (res.headers['content-type'].includes('text/event-stream') ||
                                res.headers['content-type'].includes('application/json'));

          if (res.statusCode === 200 && isEventStream) {
            req.destroy();
            resolve(true);
            return;
          }

          // 데이터를 받아보고 판단
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
            // 일부 데이터라도 받았으면 연결 가능으로 간주
            if (data.length > 0) {
              req.destroy();
              resolve(true);
            }
          });

          res.on('end', () => {
            // 데이터가 없어도 응답 자체가 왔으면 연결 가능으로 간주
            resolve(true);
          });
        });

        req.on('error', () => {
          resolve(false);
        });

        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });

        req.end();
      } catch (error) {
        this.logError(`SSE 연결 확인 중 오류 발생: ${sseEndpoint}`, error);
        resolve(false);
      }
    });
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

  // SSE 엔드포인트 닫힘 확인
  private async verifySSEClosed(sseEndpoint: string): Promise<void> {
    this.logInfo(`SSE 엔드포인트 닫힘 확인: ${sseEndpoint}`);

    let attempts = 0;
    const maxAttempts = 3;
    const retryDelayMs = 500;

    while (attempts < maxAttempts) {
      try {
        const stillConnected = await this.checkSSEConnection(sseEndpoint, 1000);

        if (!stillConnected) {
          this.logInfo(`SSE 엔드포인트 닫힘 확인됨: ${sseEndpoint}`);
          break;
        }

        this.logInfo(`SSE 엔드포인트 아직 연결 가능: ${sseEndpoint}, 재시도 대기 중...`);

        // SSE가 여전히 연결 가능하면 프로세스 핸들로 다시 종료 시도
        if (this.processHandle) {
          this.logInfo(`재시도: 프로세스 핸들로 종료 시도 (PID: ${this.processHandle.pid})`);
          this.processHandle.kill('SIGKILL');
        }

        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        attempts++;
      } catch (error) {
        break; // 오류 발생 시 체크 중단
      }
    }

    if (attempts >= maxAttempts) {
      this.logError(`SSE 엔드포인트 ${sseEndpoint}가 여러 번의 종료 시도 후에도 연결 가능할 수 있음`);
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
