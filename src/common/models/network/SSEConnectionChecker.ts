// network/SSEConnectionChecker.ts
import * as http from 'http';
import { URL } from 'url';
import { ServerStatus } from '../../types/server-status';
import { BaseMCPServer } from '../BaseMCPServer';
import { ResourceVerifier } from './ResourceVerifier';

export class SSEConnectionChecker {
  private server: BaseMCPServer;
  private resourceVerifier: ResourceVerifier;

  constructor(server: BaseMCPServer) {
    this.server = server;
    this.resourceVerifier = new ResourceVerifier(server);
  }

  async checkSSEStatus(sseEndpoint: string): Promise<ServerStatus> {
    try {
      this.server.logInfo(`SSE 엔드포인트 감지됨: ${sseEndpoint}, 연결 확인 중...`);
      const isSSEConnected = await this.checkSSEConnection(sseEndpoint);

      if (isSSEConnected) {
        this.server.logInfo(`SSE 엔드포인트 연결 성공: ${sseEndpoint}`);
        this.server.updateStatus('running');
        return { name: this.server.name, online: true };
      } else {
        this.server.logInfo(`SSE 엔드포인트 연결 실패: ${sseEndpoint}`);
        if (this.server.status === 'running') {
          this.server.updateStatus('stopped');
        }
        return { name: this.server.name, online: false };
      }
    } catch (error) {
      this.server.logError(`SSE 엔드포인트 확인 중 오류 발생: ${sseEndpoint}`, error);
      if (this.server.status === 'running') {
        this.server.updateStatus('error');
      }
      return { name: this.server.name, online: false };
    }
  }

  async stopSSEServer(sseEndpoint: string): Promise<void> {
    this.server.logInfo(`SSE 서버 종료: ${sseEndpoint}`);

    if (this.server.processHandle) {
      this.server.logInfo(`프로세스 핸들로 종료 시도 (PID: ${this.server.processHandle.pid})`);
      const killed = this.server.processHandle.kill('SIGKILL');
      this.server.logInfo(`종료 신호 전송 결과: ${killed ? '성공' : '실패'}`);
      this.server.processHandle = null;
    }

    await this.verifySSEClosed(sseEndpoint);
  }

  async verifySSEClosed(sseEndpoint: string): Promise<void> {
    this.server.logInfo(`SSE 엔드포인트 닫힘 확인: ${sseEndpoint}`);

    await this.resourceVerifier.verifyResourceClosed(
      async () => await this.checkSSEConnection(sseEndpoint, 1000),
      `SSE 엔드포인트 ${sseEndpoint}`,
      `SSE 엔드포인트 ${sseEndpoint}가 여러 번의 종료 시도 후에도 연결 가능할 수 있음`,
      () => {
        if (this.server.processHandle) {
          this.server.logInfo(`재시도: 프로세스 핸들로 종료 시도 (PID: ${this.server.processHandle.pid})`);
          this.server.processHandle.kill('SIGKILL');
        }
      }
    );
  }

  checkSSEConnection(sseEndpoint: string, timeout: number = 3000): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      try {
        const url = new URL(sseEndpoint);
        const options = this.createHttpRequestOptions(url, timeout);
        const req = http.request(options, (res) => this.handleSSEResponse(res, req, resolve));

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });

        req.end();
      } catch (error) {
        this.server.logError(`SSE 연결 확인 중 오류 발생: ${sseEndpoint}`, error);
        resolve(false);
      }
    });
  }

  private createHttpRequestOptions(url: URL, timeout: number): http.RequestOptions {
    return {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream'
      },
      timeout
    };
  }

  private handleSSEResponse(
    res: http.IncomingMessage,
    req: http.ClientRequest,
    resolve: (value: boolean) => void
  ): void {
    if (res.statusCode !== 200) {
      this.server.logInfo(`SSE 엔드포인트 응답 코드: ${res.statusCode} (연결 실패로 간주)`);
      req.destroy();
      resolve(false);
      return;
    }

    const isEventStream = res.headers['content-type'] &&
                        (res.headers['content-type'].includes('text/event-stream') ||
                          res.headers['content-type'].includes('application/json'));

    if (isEventStream) {
      req.destroy();
      resolve(true);
      return;
    }

    this.collectAndProcessSSEData(res, req, resolve);
  }

  private collectAndProcessSSEData(
    res: http.IncomingMessage,
    req: http.ClientRequest,
    resolve: (value: boolean) => void
  ): void {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;

      try {
        const response = JSON.parse(data);
        if (response.code || response.message) {
          this.server.logInfo(`SSE 엔드포인트에서 오류 응답 수신: ${JSON.stringify(response)}`);
          req.destroy();
          resolve(false);
          return;
        }
      } catch (e) {
        // JSON 파싱 실패는 무시 (일반 데이터일 수 있음)
      }

      if (data.length > 0) {
        req.destroy();
        resolve(true);
      }
    });

    res.on('end', () => {
      resolve(true);
    });
  }
}
