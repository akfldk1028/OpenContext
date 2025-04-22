// src/common/installer/InstallMethodSelector.ts
import { exec } from 'child_process';
import { MCPServerConfigExtended,ServerInstallationMethod } from '../types/server-config';

export class InstallMethodSelector {
  // 시스템 환경에 따라 최적의 설치 방법 선택
  async selectBestInstallMethod(config: MCPServerConfigExtended): Promise<ServerInstallationMethod> {
    const methods = config.installationMethods;
    
    // 기본 메서드가 지정되어 있고 사용 가능하면 해당 메서드 사용
    if (config.defaultMethod && methods[config.defaultMethod]) {
      const defaultMethod = methods[config.defaultMethod];
      if (await this.isMethodAvailable(defaultMethod.type)) {
        return defaultMethod;
      }
    }
    // 우선순위: Docker > UVX > npm > git > local
    if (methods.docker && await this.isDockerAvailable()) {
        return methods.docker;
    }
    
    if (methods.uvx && await this.isUvxAvailable()) {
      return methods.uvx;
    }
    
    if (methods.npm && await this.isNpmAvailable()) {
      return methods.npm;
    }
    
    if (methods.git && await this.isGitAvailable()) {
      return methods.git;
    }
    
    if (methods.local) {
      return methods.local;
    }
    
    // 사용 가능한 설치 방법이 없을 경우 첫 번째 방법 사용
    const firstMethod = Object.values(methods)[0];
    if (firstMethod) {
      return firstMethod;
    }
    
    // 사용 가능한 설치 방법이 없는 경우 오류 발생
    throw new Error(`서버 '${config.name}'에 대해 사용 가능한 설치 방법을 찾을 수 없습니다.`);
  }

  private getDockerHost(): string {
    // Windows 파이프 vs macOS/Linux 소켓
    return process.platform === 'win32'
      ? 'npipe:////./pipe/docker_engine'
      : 'unix:///var/run/docker.sock';
  }



  private async isMethodAvailable(methodType: string): Promise<boolean> {
    switch (methodType) {
      case 'docker':
        return await this.isDockerAvailable();
      case 'uvx':
        return await this.isUvxAvailable();
      case 'npm':
        return await this.isNpmAvailable();
      case 'git':
        return await this.isGitAvailable();
      case 'local':
        return true; // 로컬은 항상 사용 가능하다고 가정
      default:
        return false;
    }
  }
  // Docker 사용 가능 여부 확인
  private async isDockerAvailable(): Promise<boolean> {
    try {
      await this.executeCommand('docker --version');
      await this.executeCommand('docker info', { env: { ...process.env, DOCKER_HOST: this.getDockerHost() } });

      return true;
    } catch (error) {
      return false;
    }
  }
  
  // UVX 사용 가능 여부 확인
  private async isUvxAvailable(): Promise<boolean> {
    try {
      await this.executeCommand('uvx --version');
      return true;
    } catch (error) {
      return false;
    }
  }
  
  // npm 사용 가능 여부 확인
  private async isNpmAvailable(): Promise<boolean> {
    try {
      await this.executeCommand('npm --version');
      return true;
    } catch (error) {
      return false;
    }
  }
  
  // Git 사용 가능 여부 확인
  private async isGitAvailable(): Promise<boolean> {
    try {
      await this.executeCommand('git --version');
      return true;
    } catch (error) {
      return false;
    }
  }
  
  // 명령어 실행 유틸리티
  private executeCommand(command: string, options?: any): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, options, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout.toString().trim());
      });
    });
  }
}