// src/common/uninstaller/ServerUninstaller.ts
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { MCPServerConfigExtended } from '../types/server-config';
import { updateServerInstallStatus, updateServerRunningStatus } from '../configLoader'; // 추가: 설정 업데이트 임포트

export class ServerUninstaller {
  private appDataPath: string;
  
  constructor() {
    this.appDataPath = path.join(
      process.env.APPDATA || 
      (process.platform === 'darwin' 
        ? process.env.HOME + '/Library/Application Support' 
        : process.env.HOME + '/.local/share'),
      'mcp-server-manager'
    );
  }
  
  // 상태 리포팅 리스너
  private progressListeners: ((progress: {serverName: string, status: string, percent: number}) => void)[] = [];
  
  addProgressListener(listener: (progress: {serverName: string, status: string, percent: number}) => void) {
    this.progressListeners.push(listener);
  }
  
  private reportProgress(serverName: string, status: string, percent: number) {
    for (const listener of this.progressListeners) {
      listener({serverName, status, percent});
    }
  }
  
  async uninstallServer(serverName: string, config: MCPServerConfigExtended): Promise<boolean> {
    try {
      this.reportProgress(serverName, '제거 준비 중...', 0);
      
      // 서버 디렉토리 경로
      const serverDir = config.installationMethods?.[config.defaultMethod!].installDir || path.join(this.appDataPath, 'servers', serverName);
      // 메타 데이터 확인
      const metaPath = path.join(serverDir, '.mcp-meta.json');
      let metaData = null;
      
      if (fs.existsSync(metaPath)) {
        metaData = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      }
      
      // 설치 유형에 따른 제거 프로세스
      const installType = metaData?.installType ?? config.installationMethods?.[config.defaultMethod!]?.type;
      
      switch (installType) {
        case 'docker':
          await this.uninstallDocker(serverName, config, serverDir, metaData);
          break;
        case 'git':
        case 'npm':
        case 'uvx': // UVX 타입 추가
        case 'local':
          // 로컬 파일 삭제로 충분
          break;
        default:
          throw new Error(`지원하지 않는 설치 유형: ${installType}`);
      }
      
      // 서버 디렉토리 삭제
      this.reportProgress(serverName, '파일 삭제 중...', 70);
      if (fs.existsSync(serverDir)) {
        fs.rmSync(serverDir, { recursive: true, force: true });
      }
      
      // 추가: 설정 파일에서 설치 상태 업데이트
      updateServerInstallStatus(serverName, false);
      updateServerRunningStatus(serverName, false);
      console.log(`[Uninstaller] Removed ${serverName} from configuration`);
      
      this.reportProgress(serverName, '제거 완료', 100);
      return true;
    } catch (error) {
      console.error(`서버 제거 오류 (${serverName}):`, error);
      this.reportProgress(serverName, `제거 실패: ${error instanceof Error ? error.message : String(error)}`, 0);
      return false;
    }
  }
  
  private async uninstallDocker(
    serverName: string, 
    config: MCPServerConfigExtended, 
    serverDir: string,
    metaData: any
  ): Promise<void> {
    // Docker Compose 사용 시
    if (metaData?.composeFile || config.installationMethods?.dockerComposeFile) {
      this.reportProgress(serverName, 'Docker 컨테이너 중지 및 제거 중...', 30);
      
      const composeFile = metaData?.composeFile || 
                         path.join(serverDir, 'docker-compose.yml');
      
      if (fs.existsSync(composeFile)) {
        await this.executeCommand(`docker-compose -f "${composeFile}" down -v`, { cwd: serverDir });
      }
    } 
    // 개별 Docker 이미지 사용 시
    else if (metaData?.image || config.installationMethods?.dockerImage) {
      this.reportProgress(serverName, 'Docker 컨테이너 찾는 중...', 20);
      
      const image = metaData?.image || config.installationMethods?.dockerImage;
      const containerList = await this.executeCommand(`docker ps -a --filter "ancestor=${image}" --format "{{.ID}}"`);
      
      if (containerList.trim()) {
        const containerIds = containerList.trim().split('\n');
        
        this.reportProgress(serverName, 'Docker 컨테이너 중지 및 제거 중...', 30);
        
        for (const id of containerIds) {
          await this.executeCommand(`docker stop ${id}`);
          await this.executeCommand(`docker rm ${id}`);
        }
      }
      
      // 이미지 제거 (선택적)
      // await this.executeCommand(`docker rmi ${image}`);
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