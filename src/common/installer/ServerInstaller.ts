// src/common/installer/ServerInstaller.ts
import * as fs from 'fs';
import * as path from 'path';
import { spawn, exec } from 'child_process';
import { MCPServerConfigExtended } from '../types/server-config';

export class ServerInstaller {
  private appDataPath: string;
  
  constructor() {
    // 애플리케이션 데이터 폴더 설정 (OS별로 적절한 위치)
    this.appDataPath = path.join(
      process.env.APPDATA || 
      (process.platform === 'darwin' 
        ? process.env.HOME + '/Library/Application Support' 
        : process.env.HOME + '/.local/share'),
      'mcp-server-manager'
    );
    
    // 폴더 생성
    if (!fs.existsSync(this.appDataPath)) {
      fs.mkdirSync(this.appDataPath, { recursive: true });
    }
  }
  
  // 설치 과정 진행 상태 보고를 위한 리스너
  private progressListeners: ((progress: {serverName: string, status: string, percent: number}) => void)[] = [];
  
  addProgressListener(listener: (progress: {serverName: string, status: string, percent: number}) => void) {
    this.progressListeners.push(listener);
  }
  
  private reportProgress(serverName: string, status: string, percent: number) {
    for (const listener of this.progressListeners) {
      listener({serverName, status, percent});
    }
  }
  
  async installServer(serverName: string, config: MCPServerConfigExtended): Promise<boolean> {
    try {
      this.reportProgress(serverName, '설치 준비 중...', 0);
      
      // 서버 설치 디렉토리 결정
      const serverDir = config.installation.installDir || 
                        path.join(this.appDataPath, 'servers', serverName);
      
      // 디렉토리 없으면 생성
      if (!fs.existsSync(serverDir)) {
        fs.mkdirSync(serverDir, { recursive: true });
      }
      
      // 설치 유형에 따라 다른 설치 방법 사용
      switch (config.installation.type) {
        case 'git':
          return await this.installFromGit(serverName, config, serverDir);
        case 'docker':
          return await this.installFromDocker(serverName, config, serverDir);
        case 'npm':
          return await this.installFromNpm(serverName, config, serverDir);
        case 'local':
          return true; // 로컬은 이미 설치되어 있다고 가정
        default:
          throw new Error(`지원하지 않는 설치 유형: ${config.installation.type}`);
      }
    } catch (error) {
      console.error(`서버 설치 오류 (${serverName}):`, error);
      this.reportProgress(serverName, `설치 실패: ${error instanceof Error ? error.message : String(error)}`, 0);
      return false;
    }
  }
  
  private async installFromGit(
    serverName: string, 
    config: MCPServerConfigExtended, 
    serverDir: string
  ): Promise<boolean> {
    const { source, branch } = config.installation;
    
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
      if (config.installation.installCommand) {
        this.reportProgress(serverName, '의존성 설치 중...', 50);
        await this.executeCommand(config.installation.installCommand, { cwd: serverDir });
      }
      
      // 설치 설정 메타데이터 저장
      const metaData = {
        name: config.name,
        installType: config.installation.type,
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
    serverDir: string
  ): Promise<boolean> {
    // Docker 설치 로직
    // 사용자가 직접 Docker를 설치하지 않아도 되도록 내부적으로 처리합니다.
    // Docker Desktop 없이도 동작하는 경량형 Docker 엔진을 내장하거나, 
    // 애플리케이션 내에서 Docker 설치를 자동화할 수도 있습니다.

    try {
      this.reportProgress(serverName, 'Docker 이미지 준비 중...', 10);
      
      // Docker Compose 파일이 있으면 우선 사용
      if (config.installation.dockerComposeFile) {
        // docker-compose 파일 복사 또는 생성
        const composeFilePath = path.join(serverDir, 'docker-compose.yml');
        fs.writeFileSync(composeFilePath, config.installation.dockerComposeFile);
        
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
      else if (config.installation.dockerImage) {
        this.reportProgress(serverName, 'Docker 이미지 다운로드 중...', 30);
        await this.executeCommand(`docker pull ${config.installation.dockerImage}`);
        
        // 메타데이터 저장
        const metaData = {
          name: config.name,
          installType: 'docker',
          installedAt: new Date().toISOString(),
          image: config.installation.dockerImage
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
      if (fs.existsSync(serverDir)) {
        fs.rmSync(serverDir, { recursive: true, force: true });
      }
      throw error;
    }
  }
  
  private async installFromNpm(
    serverName: string, 
    config: MCPServerConfigExtended, 
    serverDir: string
  ): Promise<boolean> {
    try {
      this.reportProgress(serverName, 'NPM 패키지 설치 준비 중...', 10);
      
      // package.json 생성
      const packageJson = {
        name: `mcp-server-${serverName}`,
        version: '1.0.0',
        private: true,
        dependencies: {}
      };
      
      if (config.installation.source) {
        // NPM 패키지명으로 설치
        // packageJson.dependencies[config.installation.source] = config.installation.tag || 'latest';
      }
      
      fs.writeFileSync(
        path.join(serverDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      
      // npm install 실행
      this.reportProgress(serverName, 'NPM 패키지 설치 중...', 30);
      await this.executeCommand('npm install', { cwd: serverDir });
      
      // 설치 후 명령어 실행
      if (config.installation.installCommand) {
        this.reportProgress(serverName, '설치 후 설정 중...', 70);
        await this.executeCommand(config.installation.installCommand, { cwd: serverDir });
      }
      
      // 메타데이터 저장
      const metaData = {
        name: config.name,
        installType: 'npm',
        installedAt: new Date().toISOString(),
        package: config.installation.source
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
  
  private executeCommand(command: string, options?: any): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, options, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`명령어 실행 실패: ${error.message}\n${stderr}`));
          return;
        }
        resolve(stdout.toString());
      });
    });
  }
}