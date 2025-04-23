import * as fs from 'fs';
import * as path from 'path';
import { spawn, exec } from 'child_process';
import { MCPServerConfigExtended, ServerInstallationMethod } from '../types/server-config';
import { InstallMethodSelector } from './InstallMethodSelector';
import { updateServerInstallStatus } from '../configLoader';

export class ServerInstaller {
  private appDataPath: string;
  private methodSelector: InstallMethodSelector;
  private progressListeners: ((progress: {serverName: string, status: string, percent: number}) => void)[] = [];

  constructor() {
    this.appDataPath = path.join(
      process.env.APPDATA ||
      (process.platform === 'darwin'
        ? process.env.HOME + '/Library/Application Support'
        : process.env.HOME + '/.local/share'),
      'mcp-server-manager'
    );
    this.methodSelector = new InstallMethodSelector();

    if (!fs.existsSync(this.appDataPath)) {
      console.log('🐣 Creating app data folder at', this.appDataPath);
      fs.mkdirSync(this.appDataPath, { recursive: true });
    }
  }

  addProgressListener(listener: (progress: {serverName: string, status: string, percent: number}) => void) {
    this.progressListeners.push(listener);
  }

  private reportProgress(serverName: string, status: string, percent: number) {
    console.log(`📊 [Installer] ${serverName}: ${status} (${percent}%)`);
    for (const listener of this.progressListeners) {
      listener({ serverName, status, percent });
    }
  }

  public getInstallDir(serverName: string): string {
    return path.join(this.appDataPath, 'servers', serverName);
  }

  async installServer(serverName: string, config: MCPServerConfigExtended): Promise<{ success: boolean; method?: ServerInstallationMethod }> {
    this.reportProgress(serverName, '시작', 0);
    try {
      console.log(`⚙️ [Installer] Starting install for ${serverName}`);
      const method = await this.methodSelector.selectBestInstallMethod(config);
      this.reportProgress(serverName, `선택된 방식: ${method.type}`, 5);

      const serverDir = method.installDir || this.getInstallDir(serverName);
      if (!fs.existsSync(serverDir)) {
        fs.mkdirSync(serverDir, { recursive: true });
      }

      let success = false;
      switch (method.type) {
        case 'git':
          this.reportProgress(serverName, 'Git 설치 시작', 20);
          success = await this.installFromGit(serverName, config, serverDir, method);
          break;
        case 'docker':
          this.reportProgress(serverName, 'Docker 설치 시작', 20);
          success = await this.installFromDocker(serverName, config, serverDir, method);
          break;
        case 'npm':
          this.reportProgress(serverName, 'NPM 설치 시작', 20);
          success = await this.installFromNpm(serverName, config, serverDir, method);
          if (success) {
            this.updateCommandAndArgs(config, method);
            this.spawnServerProcess(serverName, config, serverDir);
          }
          break;
        case 'uv':  // 새로운 UV 타입 처리
          this.reportProgress(serverName, 'UV 설치 시작', 20);
          success = await this.installFromUV(serverName, config, serverDir, method);
          break;
        case 'uvx':
          this.reportProgress(serverName, 'UVX 설치 시작', 20);
          success = await this.installFromUVX(serverName, config, serverDir, method);
          break;
        case 'local':
          this.reportProgress(serverName, '로컬 실행 준비', 20);
          this.updateCommandAndArgs(config, method);
          this.spawnServerProcess(serverName, config, serverDir);
          success = true;
          break;
        default:
          throw new Error(`지원하지 않는 설치 유형: ${method.type}`);
      }

      if (success) {
        updateServerInstallStatus(serverName, true, method.type, serverDir);
        this.reportProgress(serverName, '설치 완료', 100);
        console.log(`📝 [Installer] Updated configuration for ${serverName}`);
        return { success: true, method };
      } else {
        throw new Error('Installation failed internally');
      }
    } catch (error) {
      console.error(`❌ [Installer] Error installing ${serverName}:`, error);
      this.reportProgress(serverName, `설치 실패: ${error instanceof Error ? error.message : error}`, 0);
      return { success: false };
    }
  }

  // private spawnServerProcess(serverName: string, config: MCPServerConfigExtended, cwd: string) {
  //   this.reportProgress(serverName, '서버 프로세스 시작 중...', 90);
  //   const command = config.execution!.command!;
  //   const args = config.execution!.args || [];
  //   const proc = spawn(command, args, {
  //     cwd,
  //     env: process.env,
  //     stdio: 'ignore',
  //     detached: true,
  //     shell: true
  //   });
  //   proc.unref();
  //   this.reportProgress(serverName, '서버 실행됨', 100);
  // }

private spawnServerProcess(
  serverName: string,
  config: MCPServerConfigExtended,
  cwd: string
) {
  let command = config.execution!.command!;
  const args = config.execution!.args || [];

  this.reportProgress(serverName, '서버 프로세스 시작 중...', 90);

  if (process.platform === 'win32') {
    // UVX처럼 새 창에 띄우기
    // → cmd.exe /c start "" <command> <args...>
    const winArgs = ['/c', 'start', '""', command, ...args];
    console.log(`⚙️ [Installer] Windows new window: cmd.exe ${winArgs.join(' ')}`);
        // 부모 env 복사 후 ts-node preload 옵션 지우기
    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    const proc = spawn('cmd.exe', winArgs, {
      cwd,
      env,                // ← 수정된 env 사용
      detached: true,
      stdio: 'ignore'
    });
    proc.unref();
  } else {
    // macOS/Linux 원래 방식
    console.log(`⚙️ [Installer] Spawning: ${command} ${args.join(' ')} in ${cwd}`);
    const proc = spawn(command, args, {
      cwd,
      env: process.env,
      shell: true,
      stdio: 'inherit',
      detached: true
    });
    proc.unref();
  }

  this.reportProgress(serverName, '서버 실행됨', 100);
}




  // 설치 방법에 따라 명령어와 인자 업데이트
  private updateCommandAndArgs(config: MCPServerConfigExtended, installMethod: ServerInstallationMethod): void {
    switch (installMethod.type) {
      case 'docker':
        Object.assign(config, {
            command: 'docker',
            args: [
              'run', '-p', `${config.port || 8000}:${config.port || 8000}`,
              ...Object.entries(installMethod.env || {}).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
              installMethod.dockerImage || ''
            ]
          });
        break;
      case 'uv':
        Object.assign(config, {
          command: 'uv',
          args: [
            'run', installMethod.uvxPackage || ''
          ]
        });
      case 'uvx':
        Object.assign(config, {
            command: 'uvx',
            args: [
              installMethod.uvxPackage || '',
              '--transport', installMethod.uvxTransport || 'stdio'
            ]
          });
        break;
      case 'npm':
      case 'local':
        if (!config.execution) {
          config.execution = { command: '', args: [] };
        }
        config.execution.command = installMethod.command!;
        config.execution.args = installMethod.args || [];
        break;
      // 기타 설치 방법에 대한 명령어 처리...
    }
  }
  private async installFromGit(
    serverName: string,
    config: MCPServerConfigExtended,
    serverDir: string,
    method: ServerInstallationMethod
  ): Promise<boolean> {
    if (!method.source) throw new Error('Git 저장소 URL이 지정되지 않았습니다');
    const branchArg = method.branch ? `--branch ${method.branch}` : '';
    this.reportProgress(serverName, 'Git 저장소 복제 중...', 10);
    await this.executeCommand(`git clone ${method.source} ${branchArg} .`, { cwd: serverDir });
    if (method.installCommand) {
      this.reportProgress(serverName, '의존성 설치 중...', 50);
      await this.executeCommand(method.installCommand, { cwd: serverDir });
    }
    fs.writeFileSync(
      path.join(serverDir, '.mcp-meta.json'),
      JSON.stringify({ name: config.name, installType: 'git', installedAt: new Date().toISOString(), source: method.source, branch: method.branch }, null, 2)
    );
    return true;
  }
  private async installFromDocker(
    serverName: string,
    config: MCPServerConfigExtended,
    serverDir: string,
    method: ServerInstallationMethod
  ): Promise<boolean> {
    this.reportProgress(serverName, 'Docker 이미지 준비 중...', 10);
    if (method.dockerComposeFile) {
      const file = path.join(serverDir, 'docker-compose.yml');
      fs.writeFileSync(file, method.dockerComposeFile);
      this.reportProgress(serverName, 'Docker Compose 실행 중...', 30);
      await this.executeCommand('docker-compose pull', { cwd: serverDir });
      await this.executeCommand('docker-compose up -d', { cwd: serverDir });
      fs.writeFileSync(
        path.join(serverDir, '.mcp-meta.json'),
        JSON.stringify({ name: config.name, installType: 'docker', installedAt: new Date().toISOString(), composeFile: file }, null, 2)
      );
      return true;
    } else if (method.dockerImage) {
      this.reportProgress(serverName, 'Docker 이미지 다운로드 중...', 30);
      await this.executeCommand(`docker pull ${method.dockerImage}`);
      const runCmd = `docker run -d -p ${config.port}:${config.port} ${Object.entries(method.env||{}).map(([k,v])=>`-e ${k}="${v}"`).join(' ')} ${method.dockerImage}`;
      this.reportProgress(serverName, '컨테이너 실행 중...', 60);
      await this.executeCommand(runCmd);
      fs.writeFileSync(
        path.join(serverDir, '.mcp-meta.json'),
        JSON.stringify({ name: config.name, installType: 'docker', installedAt: new Date().toISOString(), image: method.dockerImage }, null, 2)
      );
      return true;
    } else throw new Error('Docker 이미지 또는 Compose 파일이 지정되지 않았습니다');
  }

// installFromNpm 메서드 수정
private async installFromNpm(
  serverName: string,
  config: MCPServerConfigExtended,
  serverDir: string,
  method: ServerInstallationMethod
): Promise<boolean> {
  this.reportProgress(serverName, 'NPM 패키지 설치 준비 중...', 10);
  const deps = ['ts-node', 'typescript'];
  this.reportProgress(serverName, '의존성 확인 중...', 20);
  for (const d of deps) {
    try { await this.executeCommand(`${d} --version`); }
    catch { this.reportProgress(serverName, `${d} 설치 중...`, 25); await this.executeCommand(`npm install -g ${d}`); }
  }
  const pkg = { name: `mcp-server-${serverName}`, version: '1.0.0', private: true, dependencies: {} as any };
  if (method.source) pkg.dependencies[method.source] = method.tag||'latest';
  fs.writeFileSync(path.join(serverDir, 'package.json'), JSON.stringify(pkg, null, 2));
  this.reportProgress(serverName, 'npm install 실행 중...', 30);
  await this.executeCommand('npm install', { cwd: serverDir });
  if (method.installCommand) { this.reportProgress(serverName, '설치 후 설정 중...', 70); await this.executeCommand(method.installCommand, { cwd: serverDir }); }
  fs.writeFileSync(path.join(serverDir, '.mcp-meta.json'), JSON.stringify({ name: config.name, installType: 'npm', installedAt: new Date().toISOString(), package: method.source }, null, 2));
  return true;
}






private async installFromUV(
  serverName: string,
  config: MCPServerConfigExtended,
  serverDir: string,
  method: ServerInstallationMethod
): Promise<boolean> {
  try {
    this.reportProgress(serverName, 'UV 패키지 설치 준비 중...', 10);
    
    // 실행 스크립트 생성
    const scriptContent = `#!/usr/bin/env node
console.log('[run-uv.js] Script started.');

const { spawn } = require('child_process');
const path = require('path');
console.log('[run-uv.js] Modules loaded.');

const env = { ...process.env, ${Object.entries(method.env || {}).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} };
console.log('[run-uv.js] Spawning command: uv');
console.log('[run-uv.js] With args:', ${JSON.stringify(JSON.stringify(method.args))});
console.log('[run-uv.js] In directory:', ${JSON.stringify(method.args[1] || serverDir)});

const proc = spawn('uv', ${JSON.stringify(method.args)}, {
  cwd: ${JSON.stringify(method.args[1] || serverDir)},
  env,
  stdio: 'inherit'
});
console.log('[run-uv.js] UV process potentially spawned (PID: ' + (proc.pid || 'unknown') + ').');

proc.on('error', err => {
  console.error('UV 실행 오류:', err);
  process.exit(1);
});

process.on('SIGINT', () => proc.kill('SIGINT'));
process.on('SIGTERM', () => proc.kill('SIGTERM'));
`;

    const scriptPath = path.join(serverDir, 'run-uv.js');
    fs.writeFileSync(scriptPath, scriptContent);
    fs.chmodSync(scriptPath, '755');

    this.reportProgress(serverName, '서버 프로세스 시작 중...', 80);
    console.log(`⚙️ installer: launching server`);

    // Windows: 새로운 cmd 창에서 서버 실행 (cmd start 사용)
    if (process.platform === 'win32') {
      spawn('cmd.exe', ['/c', 'start', '""', 'node', scriptPath], {
        cwd: serverDir,
        detached: true,
        stdio: 'ignore'
      }).unref();
    } else {
      // Unix: 터미널에서 STDIN/OUT 상속
      spawn('node', [scriptPath], { cwd: serverDir, stdio: 'inherit' });
    }

    this.reportProgress(serverName, '설치 완료 - 서버 실행됨', 100);
    return true;
  } catch (error) {
    if (fs.existsSync(serverDir)) fs.rmSync(serverDir, { recursive: true, force: true });
    throw error;
  }
}








// UVX 설치 메서드 추가
private async installFromUVX(
    serverName: string,
    config: MCPServerConfigExtended,
    serverDir: string,
    installMethod: ServerInstallationMethod
  ): Promise<boolean> {
    try {
      this.reportProgress(serverName, 'UVX 패키지 설치 준비 중...', 10);
      const uvxPackage = installMethod.uvxPackage || installMethod.source;
      if (!uvxPackage) throw new Error('UVX 패키지 이름이 지정되지 않았습니다');

      // UVX 설치 확인
      this.reportProgress(serverName, 'UVX 확인 중...', 20);
      try {
        await this.executeCommand('uvx --version');
      } catch {
        this.reportProgress(serverName, 'UVX 글로벌 설치 중...', 30);
        await this.executeCommand('npm install -g uvx');
      }

      // 설치 인자 준비 (JSON args 우선)
      const baseArgs = installMethod.args && installMethod.args.length > 0
        ? installMethod.args
        : [uvxPackage];
        const args = [...baseArgs]; // baseArgs만 사용


      // 실행 스크립트 생성
      const scriptContent = `#!/usr/bin/env node
console.log('[run-uvx.js] Script started.');

const { spawn } = require('child_process');
const path = require('path');
console.log('[run-uvx.js] Modules loaded.');

const env = { ...process.env, ${Object.entries(installMethod.env || {}).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} };
console.log('[run-uvx.js] Spawning command: uvx');
console.log('[run-uvx.js] With args:', ${JSON.stringify(JSON.stringify(args))}); // 수정된 args 사용
console.log('[run-uvx.js] In directory:', ${JSON.stringify(serverDir)});

const proc = spawn('uvx', ${JSON.stringify(args)}, {
  cwd: ${JSON.stringify(serverDir)},
  env,
  stdio: 'inherit'
});
console.log('[run-uvx.js] UVX process potentially spawned (PID: ' + (proc.pid || 'unknown') + ').');

proc.on('error', err => {
  console.error('UVX 실행 오류:', err);
  process.exit(1);
});

process.on('SIGINT', () => proc.kill('SIGINT'));
process.on('SIGTERM', () => proc.kill('SIGTERM'));
`;
      const scriptPath = path.join(serverDir, 'run-uvx.js');
      fs.writeFileSync(scriptPath, scriptContent);
      fs.chmodSync(scriptPath, '755');

      this.reportProgress(serverName, '서버 프로세스 시작 중...', 80);
      console.log(`⚙️ installer: launching server`);

      // Windows: 새로운 cmd 창에서 서버 실행 (cmd start 사용)
      if (process.platform === 'win32') {
        spawn('cmd.exe', ['/c', 'start', '""', 'node', scriptPath], {
          cwd: serverDir,
          detached: true,
          stdio: 'ignore'
        }).unref();
      } else {
        // Unix: 터미널에서 STDIN/OUT 상속
        spawn('node', [scriptPath], { cwd: serverDir, stdio: 'inherit' });
      }

      this.reportProgress(serverName, '설치 완료 - 서버 실행됨', 100);
      return true;
    } catch (error) {
      if (fs.existsSync(serverDir)) fs.rmSync(serverDir, { recursive: true, force: true });
      throw error;
    }
  }

  private executeCommand(command: string, options?: any): Promise<string> {
    console.log(`🔧 Executing: ${command}`);
    return new Promise((resolve, reject) => {
      exec(command, options, (error, stdout, stderr) => {
        if (error) return reject(new Error(stderr.toString() || error.message));
        resolve(stdout.toString());
      });
    });
  }
}
