export interface ServerInstallationMethod {
  type: 'git' | 'docker' | 'npm' | 'local' | 'uvx';
  dockerImage?: string;
  uvxPackage?: string;
  source?: string;
  command: string;
  args: string[];
  env?: { [key: string]: string };
  branch?: string;
  tag?: string;
  installDir?: string;
  installCommand?: string;
  dockerComposeFile?: string;
  uvxTransport?: 'stdio' | 'sse';
  // 기타 필요한 필드들
}

// 실행 정보를 위한 새로운 인터페이스 추가
export interface ExecutionConfig {
  command: string;
  args: string[];
  env?: { [key: string]: string };
}

export interface MCPServerConfigExtended {
  name: string;
  description: string;
  category?: string;
  version?: string;
  installationMethods?: {
      [method: string]: ServerInstallationMethod;
  };
  defaultMethod?: string;
  port?: number;
  host?: string;
  // 설치 및 실행 상태 필드
  isInstalled?: boolean;
  isRunning?: boolean;
  installedMethod?: string;
  installedDir?: string;
  // 실행 정보 필드 추가
  execution?: ExecutionConfig;
  // 기타 필요한 필드들
}

export interface MCPConfig {
  schema_version: string;
  mcpServers: {
      [key: string]: MCPServerConfigExtended;
  };
}