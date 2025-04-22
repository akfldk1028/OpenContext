// ServerStatus는 상세 상태 정보 객체를 표현합니다
export interface ServerStatus {
  name: string;
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
      try {
        // --- 디버깅 로그 추가 ---
        console.log(`[${this.name}] Starting server with:`);
        console.log(`  Command: ${this.config.command}`);
        console.log(`  Args: ${JSON.stringify(this.config.args)}`);
        console.log(`  Env: ${JSON.stringify(this.config.env)}`); // 전달될 환경 변수 확인
        const combinedEnv = { ...process.env, ...this.config.env };
        this.processHandle = require('child_process').spawn(
          this.config.command,
          this.config.args,
          {
            env: combinedEnv, // 수정된 변수 사용
            stdio: 'pipe', // 'ignore' 대신 'pipe' 사용
            detached: true
          }
        );


      } catch (err) {
        console.error(`[${this.name}] Failed to spawn server process:`, err);
        this.status = 'error';
        throw err;
      }
    }
  
    async stop(): Promise<void> {
      // 기본 구현: 로컬 프로세스 종료
      if (this.processHandle) {
        console.log(`[${this.name}] Attempting to kill process (PID: ${this.processHandle.pid})`);
        const killed = this.processHandle.kill();  // 간단히 프로세스 종료
        console.log(`[${this.name}] Kill signal sent. Success: ${killed}`);
        this.processHandle = null;
      }
      this.status = 'stopped'; // kill 성공 여부와 관계없이 상태는 stopped로 설정
      console.log(`[${this.name}] Status set to stopped.`);
    }
  
    async checkStatus(): Promise<ServerStatus> {
      // 이 기본 구현은 processHandle에만 의존하므로 재시작 후 부정확함
      if (this.processHandle && !this.processHandle.killed) {
        return { name: this.name, online: true };
      }
      return { name: this.name, online: false };
    }
  }
  import { NetworkUtils } from '../utils/NetworkUtils';

  // LocalMCPServer: 로컬 프로세스 기반 MCP 서버
  export class LocalMCPServer extends MCPServer {
    async checkStatus(): Promise<ServerStatus> {
      console.log(`[${this.name}] Checking status...`);

      // 포트가 설정되어 있는지 확인
      if (!this.config.port) {
        console.log(`[${this.name}] No port configured. Cannot perform reliable check. Reporting based on process handle (may be inaccurate after restart).`);
        // 포트 없으면 기존 프로세스 핸들 기반 체크 (부정확할 수 있음)
        const baseStatus = await super.checkStatus(); // super.checkStatus는 processHandle만 봄
        console.log(`[${this.name}] Base process check (PID: ${this.processHandle?.pid}): online = ${baseStatus.online}`);
        return { name: this.name, online: baseStatus.online };
      }

      // 포트 체크 시도 (가장 중요한 확인)
      console.log(`[${this.name}] Checking port ${this.config.port}...`);
      let isOnline = false;
      try {
        const portOpen = await NetworkUtils.checkPortOpen(this.config.host || 'localhost', this.config.port);
        console.log(`[${this.name}] Port check result: open = ${portOpen}`);
        isOnline = portOpen; // 포트가 열려있으면 온라인

        // 상태 동기화: checkStatus 결과에 따라 내부 상태(this.status) 업데이트
        if (isOnline && this.status !== 'running') {
           console.log(`[${this.name}] Port is open, updating status to 'running'.`);
           this.status = 'running';
           // processHandle이 없으면 새로 생성 시도? (고급 기능, 일단 보류)
           // if (!this.processHandle) console.warn(`[${this.name}] Port is open but no process handle. Consider re-attaching or monitoring.`);
        } else if (!isOnline && this.status === 'running') {
           console.log(`[${this.name}] Port is closed, updating status to 'stopped'.`);
           this.status = 'stopped';
           // 관련 핸들 정리
           if (this.processHandle) {
              // this.processHandle.kill(); // 이미 종료되었을 가능성이 높음
              this.processHandle = null;
           }
        }

      } catch (portError) {
        // 포트 체크 자체에서 에러 발생 시 오프라인
        console.error(`[${this.name}] Error checking port ${this.config.port}:`, portError);
        isOnline = false;
        if (this.status === 'running') {
          console.log(`[${this.name}] Port check error, updating status to 'error'.`);
          this.status = 'error'; // 에러 상태로 변경
          if (this.processHandle) this.processHandle = null;
        }
      }

      console.log(`[${this.name}] Final status based on port check: online = ${isOnline}`);
      return { name: this.name, online: isOnline };
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
      return { name: this.name, online };
    }
  }