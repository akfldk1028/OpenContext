export interface ServerInput {
  type: 'promptString' | 'promptBoolean' | 'promptNumber' | 'select';
  id: string;
  description: string;
  defaultValue?: string | boolean | number;
  options?: string[];
  required?: boolean;
  password?: boolean;
}

export interface ServerInstallationMethod {
  type: 'git' | 'docker' | 'npm' | 'local' | 'uvx';
  dockerImage?: string;
  uvxPackage?: string;
  source?: string;
  command: string;
  args: string[];
  env?: { [key: string]: string };
  overrides?: {
    [mode: string]: {
      args?: string[];
      env?: { [key: string]: string };
    };
  };
  branch?: string;
  tag?: string;
  installDir?: string;
  installCommand?: string;
  dockerComposeFile?: string;
  uvxTransport?: 'stdio' | 'sse';
  category?: string;
  version?: string;
  installationMethods?: {
      [method: string]: ServerInstallationMethod;
  };
  defaultMethod?: string;
  inputs?: ServerInput[];
  port?: number;
  host?: string;
  isInstalled?: boolean;
  isRunning?: boolean;
  installedMethod?: string;
  installedDir?: string;
  execution?: ExecutionConfig;
  userInputs?: { [key: string]: any };
}

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
  isInstalled?: boolean;
  isRunning?: boolean;
  installedMethod?: string;
  installedDir?: string;
  currentMode?: string;
  execution?: ExecutionConfig;
  userInputs?: { [key: string]: any };
}

export interface MCPConfig {
  schema_version: string;
  mcpServers: {
      [key: string]: MCPServerConfigExtended;
  };
}