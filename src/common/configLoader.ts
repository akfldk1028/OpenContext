


// src/common/configLoader.ts
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { LocalMCPServer } from './models/LocalMCPServer';
import { RemoteMCPServer } from './models/RemoteMCPServer';
import { MCPConfig, MCPServerConfigExtended } from './types/server-config';
import { BaseMCPServer } from './models/BaseMCPServer';

// config/MCP 디렉토리 경로 결정
let configDir: string;
if (app.isPackaged) {
  // Production 환경: resources 경로 기준 (assets 폴더 확인 필요)
  // electron-react-boilerplate는 보통 resources/app/ 또는 resources/app.asar 구조를 가짐
  // assets 폴더를 패키징에 포함하도록 electron-builder.json5 설정 필요할 수 있음
  configDir = path.join(process.resourcesPath, 'assets', 'config', 'MCP');
  if (!fs.existsSync(configDir)) {
     console.error(`[configLoader] Production: MCP config 폴더를 찾을 수 없습니다: ${configDir}. Ensure config files are included in the package.`);
     // Fallback or error handling needed
     configDir = ''; // 경로 못 찾음 표시
  }
} else {
  // Development 환경: 프로젝트 루트 기준 src/common/config/MCP
  configDir = path.join(app.getAppPath(), 'src', 'common', 'config', 'MCP');
  if (!fs.existsSync(configDir)) {
     console.error(`[configLoader] Development: MCP config 폴더를 찾을 수 없습니다: ${configDir}`);
     // Fallback or error handling needed
     configDir = ''; // 경로 못 찾음 표시
  }
}

// 파일 목록 읽기 (폴더 존재 및 경로 확인 후)
const files = configDir && fs.existsSync(configDir)
                ? fs.readdirSync(configDir).filter(f => f.endsWith('.json'))
                : [];

// 설정 병합
const mcpConfig: MCPConfig = files.reduce<MCPConfig>((agg, file) => {
  const filePath = path.join(configDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as MCPConfig;
  if (!agg.schema_version && data.schema_version) {
    agg.schema_version = data.schema_version;
  }
  agg.mcpServers = { ...agg.mcpServers, ...data.mcpServers };
  return agg;
}, { schema_version: '', mcpServers: {} });

// 요약 정보: id, name, description, category, version 반환
export interface MCPConfigSummary {
  id: string;
  name: string;
  description?: string;
  category?: string;
  version?: string;
}

export function getMCPConfigSummaryList(): MCPConfigSummary[] {
  // --- configDir은 모듈 상단에서 이미 결정됨 --- 
  const files = configDir && fs.existsSync(configDir)
                ? fs.readdirSync(configDir).filter(f => f.endsWith('.json'))
                : [];
  const list: MCPConfigSummary[] = [];
  for (const file of files) {
    const id = path.basename(file, '.json');
    try {
      const data = JSON.parse(fs.readFileSync(path.join(configDir, file), 'utf8')) as MCPConfig;
      let cfg = data.mcpServers[id];
      if (!cfg) {
        const entries = Object.entries(data.mcpServers);
        if (entries.length > 0) {
          cfg = entries[0][1];
        }
      }
      if (cfg) {
        list.push({
          id,
          name: cfg.name,
          description: cfg.description,
          category: cfg.category,
          version: cfg.version,
        });
      }
    } catch (err) {
      console.warn(`Failed to load MCP config from ${file}: ${err}`);
    }
  }
  console.log(list);
  console.log(list.length);

  
  console.log(`[getMCPConfigSummaryList] 총 ${list.length}개의 서버 설정 요약 정보를 반환합니다.`);
  return list;
}


// 기본 JSON 설정 반환
export function getBaseMCPServerConfig(id: string): MCPServerConfigExtended | undefined {
  // --- configDir은 모듈 상단에서 이미 결정됨 --- 
  const filePath = path.join(configDir, `${id}.json`);
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as MCPConfig;
    return data.mcpServers[id];
  } catch (err) {
    console.error(`Failed to parse MCP config file ${filePath}: ${err}`);
    return undefined;
  }
}

/**
 * 객체나 배열 내의 문자열 값에서 플레이스홀더(${input:key})를
 * 주어진 입력값(inputs)으로 치환하는 헬퍼 함수.
 * 재귀적으로 동작하여 중첩된 구조도 처리합니다.
 */
function resolvePlaceholders(value: any, inputs: { [key: string]: any } | undefined): any {
  // 입력값이 없거나, value가 null 또는 undefined면 원본 반환
  if (!inputs || value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    // 문자열 내 ${input:key} 패턴을 찾아 inputs 객체의 값으로 치환
    return value.replace(/\${input:(\w+)}/g, (match, key) => {
      // inputs 객체에 해당 key가 존재하면 그 값으로, 없으면 원본 플레이스홀더 유지
      // TODO: inputs 정의에 defaultValue가 있다면 그것을 사용하는 로직 추가 고려
      return inputs[key] !== undefined ? String(inputs[key]) : match;
    });
  } else if (Array.isArray(value)) {
    // 배열이면 각 요소를 재귀적으로 처리
    return value.map(item => resolvePlaceholders(item, inputs));
  } else if (value && typeof value === 'object' && value.constructor === Object) {
    // 순수 객체이면 각 속성값을 재귀적으로 처리
    const resolvedObject: { [key: string]: any } = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        resolvedObject[key] = resolvePlaceholders(value[key], inputs);
      }
    }
    return resolvedObject;
  }
  // 그 외 타입(숫자, 불리언 등)은 그대로 반환
  return value;
}

/**
 * 주어진 값 (문자열, 배열, 객체) 내에 ${input:...} 플레이스홀더가 남아있는지 확인합니다.
 */
function hasUnresolvedPlaceholders(value: any): boolean {
  if (typeof value === 'string') {
    return /\${input:\w+}/.test(value);
  } else if (Array.isArray(value)) {
    return value.some(hasUnresolvedPlaceholders);
  } else if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.values(value).some(hasUnresolvedPlaceholders);
  }
  return false;
}

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
export function updateServerInstallStatus(name: string, isInstalled: boolean, method?: string, installDir?: string, userInputs?: { [key: string]: any }, mode?: string): void {
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

    // 모드 결정: UI에서 전달된 mode 사용 (이제 필수 값으로 간주)
    let currentMode = mode; // mode 파라미터 값 사용
    if (!currentMode) {
      currentMode = 'default';
    }

    // 선택된 모드에 따른 override 가져오기
    const override = selectedMethod.overrides?.[currentMode];

    // 최종 args 결정 (override 우선)
    const finalArgs = override?.args !== undefined ? override.args : selectedMethod.args;

    // 최종 env 결정 (기본 + override 병합)
    const finalEnv = { ...(selectedMethod.env ?? {}), ...(override?.env ?? {}) };

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
      currentMode: currentMode, // 전달받은 모드 저장
      execution: {
        command: selectedMethod.command,
        // 선택된 모드가 적용된 args/env 저장 (플레이스홀더 유지)
        args: finalArgs,
        env: finalEnv
      },
      userInputs: userInputs ?? {} // 전달된 userInputs 저장, 없으면 빈 객체
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
  
  // --- 1. 기본 서버 구성 로드 (mcpConfig 기반, 아직 설치되지 않은 서버) ---
  for (const [name, srvCfg] of Object.entries(mcpConfig.mcpServers)) {
    // 설치된 서버가 아니면 (userConfig에 없으면) 기본 메서드 사용
    if (!userConfig.mcpServers[name]) {
      const methodKey = srvCfg.defaultMethod;
      const baseMethod = srvCfg.installationMethods?.[methodKey!];

      if (!baseMethod) {
        console.warn(`서버 로드 실패 (${name}): 기본 설치 방법 '${methodKey}'을(를) 찾을 수 없음`);
        continue;
      }

      // 사용자 입력 값 가져오기 (설치 전이므로 항상 빈 객체)
      const userInputs = {};

      // 적용할 모드 결정 (기본 설정의 defaultMode 사용 -> 항상 'default' 사용)
      const mode = 'default'; // Uninstalled servers always start in 'default' mode conceptually

      // 적용할 override 찾기 (defaultMode 기준 -> 'default' 키 사용)
      const override = baseMethod.overrides?.default;

      // 최종 args 결정: override에 args가 있으면 사용, 없으면 기본 args 사용
      const finalArgs = override?.args !== undefined ? override.args : baseMethod.args;

      // 최종 env 결정: 기본 env와 override env 병합 (override 우선)
      const finalEnv = { ...(baseMethod.env ?? {}), ...(override?.env ?? {}) };

      // 플레이스홀더 치환
      const resolvedArgs = resolvePlaceholders(finalArgs, userInputs);
      const resolvedEnv = resolvePlaceholders(finalEnv, userInputs);

      // <<< 추가: 미해결 플레이스홀더 검사 >>>
      if (hasUnresolvedPlaceholders(resolvedArgs) || hasUnresolvedPlaceholders(resolvedEnv)) {
        console.warn(`서버 로드 실패 (${name}): 필수 입력값이 설정되지 않아 플레이스홀더가 남아있습니다. (기본 설정 사용)`);
        continue; // 이 서버 로드를 건너뛰니다.
      }
      // <<< 검사 끝 >>>

      const cfg = {
        command: baseMethod.command,
        args: resolvedArgs,
        env: resolvedEnv,
        host: srvCfg.host,
        port: srvCfg.port,
      };

      const inst = cfg.host && cfg.host !== 'localhost'
        ? new RemoteMCPServer(name, cfg)
        : new LocalMCPServer(name, cfg);

      map.set(name, inst);
    }
  }
  
  // --- 2. 설치된 서버 구성 로드 (userConfig 기반) ---
  for (const [name, srvCfg] of Object.entries(userConfig.mcpServers)) {
    // userConfig의 srvCfg는 설치 시점에 결정된 execution 정보를 가짐
    const execution = srvCfg.execution;
    if (!execution?.command || !execution?.args) {
      console.warn(`설치된 서버 '${name}'에 필요한 실행 정보가 없습니다. 생략합니다.`);
      continue;
    }

     // <<< 로직 변경 시작 >>>
     // 설치된 서버는 저장된 execution 정보와 userInputs를 사용한다.
     // override 재계산은 필요 없음. 플레이스홀더 치환만 수행.

     // 사용자 입력 값 가져오기 (srvCfg는 userConfig에서 온 것)
    const userInputs = srvCfg.userInputs ?? {};

     // 저장된 execution 정보 사용
    const savedArgs = execution.args;
    const savedEnv = execution.env;

    // 플레이스홀더 치환
    const resolvedArgs = resolvePlaceholders(savedArgs, userInputs);
    const resolvedEnv = resolvePlaceholders(savedEnv, userInputs);
    // <<< 로직 변경 끝 >>>

    // <<< 추가: 미해결 플레이스홀더 검사 >>>
    if (hasUnresolvedPlaceholders(resolvedArgs) || hasUnresolvedPlaceholders(resolvedEnv)) {
      console.warn(`서버 로드 실패 (${name}): 필수 입력값이 설정되지 않아 플레이스홀더가 남아있습니다. (설치된 설정 사용)`);
      continue; // 이 서버 로드를 건너뛰니다.
    }
    // <<< 검사 끝 >>>

    const cfg = {
      command: execution.command,
      args: resolvedArgs,
      env: resolvedEnv,
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

/**
 * 설치된 서버의 구성(모드, 사용자 입력)을 업데이트하고 userServers.json에 저장합니다.
 * execution 정보도 새로운 모드에 맞춰 다시 계산되어 저장됩니다.
 */
export function updateServerConfiguration(
  serverName: string,
  updates: { mode?: string; inputs?: { [key: string]: any } }
): void {
  // 1. userConfig에서 현재 서버 설정 가져오기
  const currentUserConfig = userConfig.mcpServers[serverName];
  if (!currentUserConfig) {
    console.error(`[updateServerConfiguration] 설정 업데이트 실패: 서버 '${serverName}'가 userServers.json에 존재하지 않습니다.`);
    return;
  }

  // 2. mcpConfig에서 기본 서버 설정 가져오기 (설치 방법 정보 필요)
  const baseServerConfig = mcpConfig.mcpServers[serverName];
  if (!baseServerConfig) {
    console.error(`[updateServerConfiguration] 설정 업데이트 실패: 기본 설정에서 서버 '${serverName}'를 찾을 수 없습니다.`);
    return;
  }

  // 3. 설치된 방법 가져오기
  const installedMethodKey = currentUserConfig.installedMethod;
  if (!installedMethodKey) {
    console.error(`[updateServerConfiguration] 설정 업데이트 실패: 서버 '${serverName}'에 설치된 방법 정보가 없습니다.`);
    return;
  }
  const installedMethod = baseServerConfig.installationMethods?.[installedMethodKey];
  if (!installedMethod) {
    console.error(`[updateServerConfiguration] 설정 업데이트 실패: 기본 설정에서 설치 방법 '${installedMethodKey}'를 찾을 수 없습니다.`);
    return;
  }

  // 4. 업데이트될 모드와 입력값 결정
  // mode가 제공되면 사용, 아니면 기존 currentMode 사용
  const targetMode = updates.mode ?? currentUserConfig.currentMode;
  // inputs가 제공되면 사용, 아니면 기존 userInputs 사용
  const targetInputs = updates.inputs ?? currentUserConfig.userInputs ?? {};

  // 5. 새로운 모드에 따른 override 계산
  const override = targetMode ? installedMethod.overrides?.[targetMode] : undefined;

  // 6. 새로운 execution 정보 계산 (override 적용)
  const newFinalArgs = override?.args !== undefined ? override.args : installedMethod.args;
  const newFinalEnv = { ...(installedMethod.env ?? {}), ...(override?.env ?? {}) };

  // 7. userConfig 업데이트
  userConfig.mcpServers[serverName] = {
    ...currentUserConfig, // 기존 정보 유지 (name, description, isInstalled 등)
    currentMode: targetMode, // 새로운 모드 업데이트
    userInputs: targetInputs, // 새로운 입력값 업데이트
    execution: { // 새로운 실행 정보 업데이트
      command: installedMethod.command,
      args: newFinalArgs, // 새로 계산된 args (플레이스홀더 유지)
      env: newFinalEnv,  // 새로 계산된 env (플레이스홀더 유지)
    },
  };

  // 8. 변경사항 저장
  saveUserConfig();
  console.log(`[updateServerConfiguration] 서버 '${serverName}' 설정 업데이트 완료.`);
}