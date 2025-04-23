// // src/common/configLoader.ts
// import { MCPServer, LocalMCPServer, RemoteMCPServer } from './models/mcpserver';
// import { MCPConfig, MCPServerConfigExtended } from './types/server-config';
// import raw from './config/mcpServer.json';   // <<— webpack will bundle this

// const mcpConfig = raw as MCPConfig;

// export function loadMCPServers(): Map<string, MCPServer> {
//   const map = new Map<string, MCPServer>();
//   for (const [name, srvCfg] of Object.entries(mcpConfig.mcpServers)) {
//     const method = srvCfg.installationMethods[srvCfg.defaultMethod!];
//     const cfg = {
//       command: method.command,
//       args:    method.args,
//       env:     method.env,
//       host:    srvCfg.host,
//       port:    srvCfg.port,
//     };
//     const inst = cfg.host && cfg.host !== 'localhost'
//       ? new RemoteMCPServer(name, cfg)
//       : new LocalMCPServer(name, cfg);
//     map.set(name, inst);
//   }
//   return map;
// }

// export function getMCPServerConfig(name: string): MCPServerConfigExtended | undefined {
//   return mcpConfig.mcpServers[name];
// }


// src/common/configLoader.ts
import * as fs from 'fs';
import * as path from 'path';
import { LocalMCPServer } from './models/LocalMCPServer';
import { RemoteMCPServer } from './models/RemoteMCPServer';
import { MCPConfig, MCPServerConfigExtended } from './types/server-config';
import raw from './config/mcpServer.json';   // <<— webpack will bundle this
import { BaseMCPServer } from './models/BaseMCPServer';

// 기본 설정 로드
const mcpConfig = raw as MCPConfig;

// 사용자 데이터 경로
const appDataPath = path.join(
  process.env.APPDATA || 
  (process.platform === 'darwin' 
    ? process.env.HOME + '/Library/Application Support' 
    : process.env.HOME + '/.local/share'),
  'mcp-server-manager'
);

// 사용자 설정 파일 경로
const userConfigPath = path.join(appDataPath, 'userServers.json');

// 디렉토리 확인 및 생성
if (!fs.existsSync(appDataPath)) {
  fs.mkdirSync(appDataPath, { recursive: true });
}

// 사용자 설정 로드 (없으면 빈 객체)
let userConfig: MCPConfig = {
  schema_version: mcpConfig.schema_version,
  mcpServers: {}
};

// 사용자 설정 파일 존재 여부 확인 및 로드
if (fs.existsSync(userConfigPath)) {
  try {
    const userConfigData = fs.readFileSync(userConfigPath, 'utf8');
    userConfig = JSON.parse(userConfigData);
  } catch (error) {
    console.error('사용자 설정 파일 로드 실패:', error);
  }
}

// 결합된 설정 (기본 + 사용자)
const combinedConfig: MCPConfig = {
  schema_version: mcpConfig.schema_version,
  mcpServers: { ...mcpConfig.mcpServers, ...userConfig.mcpServers }
};

// 사용자 설정 저장 함수
export function saveUserConfig(): void {
  try {
    // 폴더 확인
    if (!fs.existsSync(path.dirname(userConfigPath))) {
      fs.mkdirSync(path.dirname(userConfigPath), { recursive: true });
    }

    // 파일 저장
    fs.writeFileSync(userConfigPath, JSON.stringify(userConfig, null, 2), 'utf8');
    console.log('사용자 설정 저장 완료:', userConfigPath);
  } catch (error) {
    console.error('사용자 설정 저장 실패:', error);
  }
}

// 서버 설치 상태 업데이트
export function updateServerInstallStatus(name: string, isInstalled: boolean, method?: string, installDir?: string): void {
  // 서버 정보 가져오기
  const serverConfig = combinedConfig.mcpServers[name];
  if (!serverConfig) {
    console.error(`서버를 찾을 수 없음: ${name}`);
    return;
  }

  // 설치된 서버 정보만 저장
  if (isInstalled && method) {
    const selectedMethod = serverConfig.installationMethods?.[method];
    if (!selectedMethod) {
      console.error(`설치 방법을 찾을 수 없음: ${method}`);
      return;
    }

    // 간소화된 서버 정보 생성
    userConfig.mcpServers[name] = {
      name: serverConfig.name,
      description: serverConfig.description,
      category: serverConfig.category,
      version: serverConfig.version,
      port: serverConfig.port,
      isInstalled: true,
      isRunning: false, // 처음 설치 시 기본값
      installedMethod: method,
      installedDir: installDir,
      execution: {
        command: selectedMethod.command,
        args: selectedMethod.args,
        env: selectedMethod.env
      }
    };
  } else if (!isInstalled) {
    // 제거 시 서버 정보 삭제
    delete userConfig.mcpServers[name];
  }
  
  // 설정 저장
  saveUserConfig();
}

// 서버 실행 상태 업데이트
export function updateServerRunningStatus(name: string, isRunning: boolean): void {
  // 사용자 설정에 서버가 없으면 기본 설정에서 복사
  if (!userConfig.mcpServers[name]) {
    if (combinedConfig.mcpServers[name]) {
      userConfig.mcpServers[name] = { ...combinedConfig.mcpServers[name] };
    } else {
      console.error(`서버를 찾을 수 없음: ${name}`);
      return;
    }
  }
  
  // 실행 상태 업데이트
  userConfig.mcpServers[name].isRunning = isRunning;
  
  // 설정 저장
  saveUserConfig();
}

// 기존 loadMCPServers 함수 수정 (combinedConfig 사용)
export function loadMCPServers(): Map<string, BaseMCPServer> {
  const map = new Map<string, BaseMCPServer>();
  
  // 기본 서버 구성 로드
  for (const [name, srvCfg] of Object.entries(mcpConfig.mcpServers)) {
    // 설치된 서버가 아니면 기본 메서드 사용
    if (!userConfig.mcpServers[name]) {
      const method = srvCfg.installationMethods?.[srvCfg.defaultMethod!];
      
      if (!method) {
        console.warn(`서버 로드 실패 (${name}): 기본 설치 방법을 찾을 수 없음`);
        continue;
      }
      
      const cfg = {
        command: method.command,
        args: method.args,
        env: method.env,
        host: srvCfg.host,
        port: srvCfg.port,
      };
      
      const inst = cfg.host && cfg.host !== 'localhost'
        ? new RemoteMCPServer(name, cfg)
        : new LocalMCPServer(name, cfg);
      
      map.set(name, inst);
    }
  }
  
  // 설치된 서버 구성 로드
  for (const [name, srvCfg] of Object.entries(userConfig.mcpServers)) {
    // 필수 속성이 있는지 확인
    if (!srvCfg.execution?.command || !srvCfg.execution?.args) {
      console.warn(`서버 '${name}'에 필요한 실행 정보가 없습니다. 생략합니다.`);
      continue;
    }
    
    const cfg = {
      command: srvCfg.execution.command,
      args: srvCfg.execution.args,
      env: srvCfg.execution.env,
      host: srvCfg.host,
      port: srvCfg.port,
    };
    
    const inst = cfg.host && cfg.host !== 'localhost'
      ? new RemoteMCPServer(name, cfg)
      : new LocalMCPServer(name, cfg);
    
    // 저장된 상태에 따라 서버 상태 설정
    if (srvCfg.isRunning) {
      inst.status = 'running';
    }
    
    map.set(name, inst);
  }
  
  return map;
}

export function getMCPServerConfig(name: string): MCPServerConfigExtended | undefined {
  return combinedConfig.mcpServers[name];
}