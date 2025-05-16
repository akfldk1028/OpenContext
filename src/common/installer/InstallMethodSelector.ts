// src/common/installer/InstallMethodSelector.ts
import { exec } from 'child_process';
import {
  MCPServerConfigExtended,
  ServerInstallationMethod,
} from '../types/server-config';

export class InstallMethodSelector {
  // 시스템 환경에 따라 최적의 설치 방법 선택
  async selectBestInstallMethod(
    config: MCPServerConfigExtended,
  ): Promise<ServerInstallationMethod> {
    const methods = config.installationMethods || {};

    // 실제 존재하는 메서드들만 확인
    const availableMethods = Object.keys(methods);

    if (availableMethods.length === 0) {
      throw new Error(
        `서버 '${config.name}'에 대해 사용 가능한 설치 방법이 없습니다.`,
      );
    }

    // 기본 메서드가 정의되어 있고 실제로 존재하면 먼저 확인
    if (config.defaultMethod && methods[config.defaultMethod]) {
      const defaultMethod = methods[config.defaultMethod];
      if (await this.isMethodAvailable(defaultMethod.type)) {
        return defaultMethod;
      }
    }

    // 우선순위에 따라 실제 존재하는 메서드만 확인
    const priorityOrder = ['docker', 'uvx', 'npm', 'git', 'local'];
    for (const methodType of priorityOrder) {
      if (methods[methodType] && (await this.isMethodAvailable(methodType))) {
        return methods[methodType];
      }
    }

    // 어떤 메서드도 사용할 수 없으면 첫 번째 메서드 시도
    return Object.values(methods)[0];
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
      case 'uv':
        return await this.isUvAvailable();
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
      await this.executeCommand('docker info', {
        env: { ...process.env, DOCKER_HOST: this.getDockerHost() },
      });
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

  private async isUvAvailable(): Promise<boolean> {
    try {
      await this.executeCommand('uv --version');
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
