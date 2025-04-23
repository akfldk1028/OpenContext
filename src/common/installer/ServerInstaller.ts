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
    /** 서버별 설치 폴더 경로를 외부에서 조회할 때 쓰는 헬퍼 */
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
     

      console.log(`📂 installer: installing "${serverName}" to directory:`, serverDir);

      if (!fs.existsSync(serverDir)) {
        fs.mkdirSync(serverDir, { recursive: true });
      }

 

      let success: boolean = false;
      switch (method.type) {
        case 'git':
          this.reportProgress(serverName, 'Git 설치 시작', 20);
          success = await this.installFromGit(serverName, config, serverDir, method);
          console.log(`🎉 [Installer] Git install finished for ${serverName}`);
          break;
        case 'docker':
          this.reportProgress(serverName, 'Docker 설치 시작', 20);
          success = await this.installFromDocker(serverName, config, serverDir, method);
          console.log(`🐳 [Installer] Docker install finished for ${serverName}`);
          break;
        case 'npm':
          this.reportProgress(serverName, 'NPM 설치 시작', 20);
          success = await this.installFromNpm(serverName, config, serverDir, method);
          console.log(`📦 [Installer] NPM install finished for ${serverName}`);
          break;
        case 'uvx':
          this.reportProgress(serverName, 'UVX 설치 시작', 20);
          success = await this.installFromUVX(serverName, config, serverDir, method);
          console.log(`⚡️ [Installer] UVX install finished for ${serverName}`);
          break;
        case 'local':
          this.reportProgress(serverName, '로컬 설치 (스킵)', 100);
          console.log(`✅ [Installer] Local skip for ${serverName}`);
          success = true;
          break;
        default:
          throw new Error(`지원하지 않는 설치 유형: ${method.type}`);
      }

      if (success) {
        this.reportProgress(serverName, '설치 완료', 100);
        
        // 추가: 설치 성공 시 설정 파일 업데이트
        updateServerInstallStatus(serverName, true, method.type, serverDir);
        console.log(`📝 [Installer] Updated configuration for ${serverName}`);
        
        return { success: true, method: method }; // 성공 시 선택된 method 반환
      } else {
        throw new Error('Installation failed internally'); // 내부 실패 처리
      }
    } catch (error) {
      console.error(`❌ [Installer] Error installing ${serverName}:`, error);
      this.reportProgress(serverName, `설치 실패: ${error instanceof Error ? error.message : error}`, 0);
      return { success: false }; // 실패 시 success: false 반환
    }
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
        Object.assign(config, { 
            command: 'npx',
            args: [installMethod.source || '']
          });
        break;
      // 기타 설치 방법에 대한 명령어 처리...
    }
  }

  private async installFromGit(
    serverName: string, 
    config: MCPServerConfigExtended, 
    serverDir: string,
    installMethod: ServerInstallationMethod
  ): Promise<boolean> {
    const source = installMethod.source;
    const branch = installMethod.branch;

    
    if (!source) {
      throw new Error('Git 저장소 URL이 지정되지 않았습니다');
    }
    
    // Git 명령어 준비
    const gitBranch = branch ? `--branch ${branch}` : '';
    
    try {
      // Git 클론
      this.reportProgress(serverName, 'Git 저장소 복제 중...', 10);
      await this.executeCommand(`git clone ${source} ${gitBranch} .`, { cwd: serverDir });
      
      // 의존성 설치
      if (installMethod.installCommand) {
        this.reportProgress(serverName, '의존성 설치 중...', 50);
        await this.executeCommand(installMethod.installCommand, { cwd: serverDir });
      }
      
      // 설치 설정 메타데이터 저장
      const metaData = {
        name: config.name,
        installType: installMethod.type,
        installedAt: new Date().toISOString(),
        source,
        branch
      };
      
      fs.writeFileSync(
        path.join(serverDir, '.mcp-meta.json'),
        JSON.stringify(metaData, null, 2)
      );
      
      this.reportProgress(serverName, '설치 완료', 100);
      return true;
    } catch (error) {
      // 설치 실패 시 디렉토리 정리
      if (fs.existsSync(serverDir)) {
        fs.rmSync(serverDir, { recursive: true, force: true });
      }
      throw error;
    }
  }
  
  private async installFromDocker(
    serverName: string, 
    config: MCPServerConfigExtended, 
    serverDir: string,
    installMethod: ServerInstallationMethod
  ): Promise<boolean> {
    // Docker 설치 로직
    // 사용자가 직접 Docker를 설치하지 않아도 되도록 내부적으로 처리합니다.
    // Docker Desktop 없이도 동작하는 경량형 Docker 엔진을 내장하거나, 
    // 애플리케이션 내에서 Docker 설치를 자동화할 수도 있습니다.

    try {
      this.reportProgress(serverName, 'Docker 이미지 준비 중...', 10);
      
      // Docker Compose 파일이 있으면 우선 사용
    // Docker Compose 파일이 있으면 우선 사용
    if (installMethod.dockerComposeFile) {
        // docker-compose 파일 복사 또는 생성
        const composeFilePath = path.join(serverDir, 'docker-compose.yml');
        fs.writeFileSync(composeFilePath, installMethod.dockerComposeFile);

        // docker-compose 실행
        this.reportProgress(serverName, 'Docker Compose 설정 중...', 30);
        await this.executeCommand('docker-compose pull', { cwd: serverDir });
        
        // 메타데이터 저장
        const metaData = {
          name: config.name,
          installType: 'docker',
          installedAt: new Date().toISOString(),
          composeFile: composeFilePath
        };
        
        fs.writeFileSync(
          path.join(serverDir, '.mcp-meta.json'),
          JSON.stringify(metaData, null, 2)
        );
        
        this.reportProgress(serverName, '설치 완료', 100);
        return true;
      } 
      // Docker 이미지를 직접 사용하는 경우
      else if (installMethod.dockerImage) {
        console.log(`⚙️ installer: docker pull ${installMethod.dockerImage}`);
        this.reportProgress(serverName, 'Docker 이미지 다운로드 중...', 30);
        await this.executeCommand(`docker pull ${installMethod.dockerImage}`);
              // 이제 컨테이너 실행
        const runCmd = `docker run -d -p ${config.port}:${config.port} ${Object.entries(installMethod.env || {})
        .map(([k,v]) => `-e ${k}="${v}"`).join(' ')} ${installMethod.dockerImage}`;
        console.log(`⚙️ installer: ${runCmd}`);
        this.reportProgress(serverName, '컨테이너 실행 중...', 60);
        await this.executeCommand(runCmd);
        // 메타데이터 저장
        const metaData = {
            name: config.name,
            installType: 'docker',
            installedAt: new Date().toISOString(),
            image: installMethod.dockerImage
        };
        
        fs.writeFileSync(
            path.join(serverDir, '.mcp-meta.json'),
            JSON.stringify(metaData, null, 2)
        );
        
        this.reportProgress(serverName, '설치 완료', 100);
        return true;
      } else {
        throw new Error('Docker 이미지 또는 Compose 파일이 지정되지 않았습니다');
      }
    } catch (error) {
      console.error(`❌ [Installer] Docker 설치 오류:`, error);
      if (fs.existsSync(serverDir)) {
        fs.rmSync(serverDir, { recursive: true, force: true });
      }
      throw error;
    }
  }
  
// installFromNpm 메서드 수정
private async installFromNpm(
    serverName: string, 
    config: MCPServerConfigExtended, 
    serverDir: string,
    installMethod: ServerInstallationMethod
  ): Promise<boolean> {
    try {
      this.reportProgress(serverName, 'NPM 패키지 설치 준비 중...', 10);
      
      // package.json 생성
      const packageJson = {
        name: `mcp-server-${serverName}`,
        version: '1.0.0',
        private: true,
        dependencies: {} as Record<string, string>
      };
      
      if (installMethod.source) {
        // NPM 패키지명으로 설치
        packageJson.dependencies[installMethod.source] = installMethod.tag || 'latest';
      }
      
      
      fs.writeFileSync(
        path.join(serverDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      
      // npm install 실행
      this.reportProgress(serverName, 'NPM 패키지 설치 중...', 30);
      await this.executeCommand('npm install', { cwd: serverDir });
      
    // 설치 후 명령어 실행
    if (installMethod.installCommand) {
        this.reportProgress(serverName, '설치 후 설정 중...', 70);
        await this.executeCommand(installMethod.installCommand, { cwd: serverDir });
      }
      
      const metaData = {
        name: config.name,
        installType: 'npm',
        installedAt: new Date().toISOString(),
        package: installMethod.source
      };
      
      
      fs.writeFileSync(
        path.join(serverDir, '.mcp-meta.json'),
        JSON.stringify(metaData, null, 2)
      );
      
      this.reportProgress(serverName, '설치 완료', 100);
      return true;
    } catch (error) {
      if (fs.existsSync(serverDir)) {
        fs.rmSync(serverDir, { recursive: true, force: true });
      }
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
