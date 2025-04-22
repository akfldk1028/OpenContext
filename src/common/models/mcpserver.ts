// ServerStatus는 상세 상태 정보 객체를 표현합니다
export interface ServerStatus {
  online: boolean;
  pingMs?: number;
}

// 공통 인터페이스 정의
interface IMCPServer {
    name: string;
    status: 'stopped' | 'running' | 'error';  // 서버 상태 표현
    start(): Promise<void>;
    stop(): Promise<void>;
    checkStatus(): Promise<ServerStatus>;      // ServerStatus는 상세 상태 정보 객체 (예: { online: boolean, pingMs?: number })
  }

  // MCP 서버 설정 정보를 표현하는 타입
export type MCPServerConfig = {
    command: string;
    args: string[];
    env?: { [key: string]: string };   // 환경변수 (선택사항)
    host?: string;                     // 원격 서버의 호스트 (로컬이면 생략 또는 'localhost')
    port?: number;                     // 원격 서버 포트 (해당되는 경우만)
  };
  

// 기본 MCPServer 클래스
export class MCPServer implements IMCPServer {
    name: string;
    config: MCPServerConfig;
    status: 'stopped' | 'running' | 'error' = 'stopped';
    protected processHandle: import('child_process').ChildProcess | null = null;  // 로컬 프로세스 핸들 (로컬일 경우)
  
    constructor(name: string, config: MCPServerConfig) {
      this.name = name;
      this.config = config;
    }
  
    async start(): Promise<void> {
      // 기본 구현: 로컬 프로세스 실행
      try {
        this.processHandle = require('child_process').spawn(
          this.config.command, 
          this.config.args, 
          { env: this.config.env || process.env, stdio: 'ignore', detached: true }
        );
        this.status = 'running';
      } catch (err) {
        console.error(`Failed to start server ${this.name}:`, err);
        this.status = 'error';
        throw err;
      }
    }
  
    async stop(): Promise<void> {
      // 기본 구현: 로컬 프로세스 종료
      if (this.processHandle) {
        this.processHandle.kill();  // 간단히 프로세스 종료
        this.processHandle = null;
      }
      this.status = 'stopped';
    }
  
    async checkStatus(): Promise<ServerStatus> {
      // 기본 구현: 프로세스가 살아있는지 또는 포트 확인
      if (this.processHandle) {
        const alive = !this.processHandle.killed;
        return { online: alive };
      }
      // 프로세스 핸들이 없으면 원격 혹은 실행 안 됨: 하위 클래스에서 override하거나 기본은 offline 반환
      return { online: false };
    }
  }
  import { NetworkUtils } from '../utils/NetworkUtils';

  // LocalMCPServer: 로컬 프로세스 기반 MCP 서버
  export class LocalMCPServer extends MCPServer {
    // 필요에 따라 start/stop을 MCPServer와 동일하게 사용 (기본 구현이 이미 로컬 프로세스 처리)
    // LocalMCPServer는 기본 동작을 대부분 상속하지만, 추가로 상태 체크를 보강 가능
    async checkStatus(): Promise<ServerStatus> {
      const status = await super.checkStatus();
      // 로컬 프로세스인 경우 별도 포트가 있을 수 있음 -> config.port가 지정되었다면 포트 ping 등
      if (status.online && this.config.port) {
        const portOpen = await NetworkUtils.checkPortOpen(this.config.host || 'localhost', this.config.port);
        return { online: status.online && portOpen };
      }
      return status;
    }
  }
  
  // RemoteMCPServer: 원격 서버 기반 MCP
  export class RemoteMCPServer extends MCPServer {
    constructor(name: string, config: MCPServerConfig) {
      super(name, config);
    }
    async start(): Promise<void> {
      // 원격 서버는 start가 별도 의미 없을 수 있음 (혹은 원격 연결 시도)
      this.status = 'running';
    }
    async stop(): Promise<void> {
      // 원격 서버는 stop 대신 연결 해제 정도만
      this.status = 'stopped';
    }
    async checkStatus(): Promise<ServerStatus> {
      // 네트워크 핑/포트 체크로 상태 확인
      const host = this.config.host || 'localhost';
      const port = this.config.port;
      let online = false;
      if (port) {
        online = await NetworkUtils.checkPortOpen(host, port);
      } else {
        online = await NetworkUtils.pingHost(host);
      }
      return { online };
    }
  }