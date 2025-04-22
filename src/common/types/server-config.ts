export interface ServerInstallationMethod {
    type: 'git' | 'docker' | 'npm' | 'local' | 'uvx' ;
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
  
  export interface MCPServerConfigExtended {
    name: string;
    description: string;
    category?: string;
    version?: string;
    installationMethods: {
      [method: string]: ServerInstallationMethod;
    };
    defaultMethod?: string;
    port?: number;
    host?: string;
    // 기타 필요한 필드들
  }
  
  export interface MCPConfig {
    schema_version: string;
    mcpServers: {
      [key: string]: MCPServerConfigExtended;
    };
  }