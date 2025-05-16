// src/common/integration/ClaudeDesktopIntegration.ts

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class ClaudeDesktopIntegration {
  private configPath: string;

  constructor() {
    // Claude Desktop 설정 파일 경로
    const appDataPath =
      process.env.APPDATA ||
      (process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library', 'Application Support')
        : path.join(os.homedir(), '.config'));

    const claudeFolder = path.join(appDataPath, 'Claude');

    this.configPath = path.join(claudeFolder, 'claude_desktop_config.json');

    console.log(`[Claude Desktop] APPDATA 환경 변수: ${process.env.APPDATA}`);
    console.log(`[Claude Desktop] 계산된 앱 데이터 경로: ${appDataPath}`);
    console.log(`[Claude Desktop] Claude 폴더 경로: ${claudeFolder}`);
    console.log(`[Claude Desktop] 설정 파일 전체 경로: ${this.configPath}`);

    // 디렉토리 존재 여부 확인
    if (!fs.existsSync(claudeFolder)) {
      console.log(`[Claude Desktop] 경고: Claude 디렉토리가 존재하지 않습니다: ${claudeFolder}`);
      try {
        fs.mkdirSync(claudeFolder, { recursive: true });
        console.log('[Claude Desktop] Claude 디렉토리 생성 성공');
      } catch (error) {
        console.error('[Claude Desktop] Claude 디렉토리 생성 실패:', error);
      }
    } else {
      console.log('[Claude Desktop] Claude 디렉토리 존재함');
    }

    // 파일 존재 여부 확인
    if (fs.existsSync(this.configPath)) {
      console.log(`[Claude Desktop] 설정 파일 존재함, 크기: ${fs.statSync(this.configPath).size} 바이트`);
      try {
        const content = fs.readFileSync(this.configPath, 'utf8');
        console.log(`[Claude Desktop] 설정 파일 내용 샘플(처음 100자): ${content.substring(0, 100)}...`);
      } catch (error) {
        console.error('[Claude Desktop] 설정 파일 읽기 실패:', error);
      }
    } else {
      console.log('[Claude Desktop] 설정 파일이 존재하지 않음');
    }
  }

  // MCP 서버를 Claude Desktop에 연결
  connectServer(serverName: string, serverConfig: any): boolean {
    try {
      if (!serverConfig.execution || !serverConfig.execution.command) {
        console.error(`서버 ${serverName}에 필요한 실행 정보가 없습니다.`);
        return false;
      }
      // 파일 존재 여부 확인
      const fileExists = fs.existsSync(this.configPath);
      console.log(`[Claude Desktop] 설정 파일 존재 여부: ${fileExists}`);

      // 파일 내용 로그
      if (fileExists) {
        const currentContent = fs.readFileSync(this.configPath, 'utf8');
        console.log(`[Claude Desktop] 현재 파일 내용: ${currentContent}`);
      }

      // 현재 설정 가져오기
      let config = { mcpServers: {} };
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        try {
          config = JSON.parse(data);
          if (!config.mcpServers) config.mcpServers = {};
        } catch (e) {
          console.error('[Claude Desktop] 설정 파일 파싱 실패:', e);
        }
      }

      // 서버 추가/업데이트
      config.mcpServers[serverName] = {
        command: serverConfig.execution.command,
        args: serverConfig.execution.args || [],
      };

      // 환경 변수가 있으면 추가
      if (serverConfig.execution.env && Object.keys(serverConfig.execution.env).length > 0) {
        config.mcpServers[serverName].env = serverConfig.execution.env;
      }

      // 설정 저장
      const dirPath = path.dirname(this.configPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
      console.log(`[Claude Desktop] 서버 ${serverName} 추가됨, 설정 저장됨`);
      const afterContent = fs.readFileSync(this.configPath, 'utf8');
      console.log(`[Claude Desktop] 저장 후 파일 내용: ${afterContent}`);

      return true;
    } catch (error) {
      console.error(`[Claude Desktop] 서버 ${serverName} 연결 중 오류:`, error);
      return false;
    }
  }

  // Claude Desktop에서 MCP 서버 연결 해제
  disconnectServer(serverName: string): boolean {
    try {
      // 현재 설정이 없으면 성공으로 간주
      if (!fs.existsSync(this.configPath)) {
        return true;
      }

      // 현재 설정 가져오기
      let config = { mcpServers: {} };
      const data = fs.readFileSync(this.configPath, 'utf8');
      try {
        config = JSON.parse(data);
        if (!config.mcpServers) config.mcpServers = {};
      } catch (e) {
        console.error('[Claude Desktop] 설정 파일 파싱 실패:', e);
        return false;
      }

      // 서버가 없으면 성공으로 간주
      if (!config.mcpServers[serverName]) {
        return true;
      }

      // 서버 제거
      delete config.mcpServers[serverName];

      // 설정 저장
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
      console.log(`[Claude Desktop] 서버 ${serverName} 제거됨, 설정 저장됨`);

      return true;
    } catch (error) {
      console.error(`[Claude Desktop] 서버 ${serverName} 연결 해제 중 오류:`, error);
      return false;
    }
  }

  // 서버가 Claude Desktop에 연결되어 있는지 확인
  isServerConnected(serverName: string): boolean {
    try {
      if (!fs.existsSync(this.configPath)) {
        return false;
      }

      const data = fs.readFileSync(this.configPath, 'utf8');
      const config = JSON.parse(data);

      return !!(config && config.mcpServers && config.mcpServers[serverName]);
    } catch (error) {
      console.error('[Claude Desktop] 연결 상태 확인 중 오류:', error);
      return false;
    }
  }

  // 모든 연결된 서버 목록 반환
  getAllConnectedServers(): string[] {
    try {
      if (!fs.existsSync(this.configPath)) {
        return [];
      }

      const data = fs.readFileSync(this.configPath, 'utf8');
      const config = JSON.parse(data);

      if (config && config.mcpServers) {
        return Object.keys(config.mcpServers);
      }

      return [];
    } catch (error) {
      console.error('[Claude Desktop] 서버 목록 가져오기 중 오류:', error);
      return [];
    }
  }

  // ClaudeDesktopIntegration.ts에 테스트 메서드 추가
  testFileAccess(): boolean {
    try {
      const testPath = path.join(path.dirname(this.configPath), 'test.txt');
      console.log(`[Claude Desktop] 테스트 파일 경로: ${testPath}`);

      // 테스트 파일 쓰기
      fs.writeFileSync(testPath, 'Test content', 'utf8');
      console.log('[Claude Desktop] 테스트 파일 쓰기 성공');

      // 테스트 파일 읽기
      const content = fs.readFileSync(testPath, 'utf8');
      console.log(`[Claude Desktop] 테스트 파일 읽기 성공: ${content}`);

      // 테스트 파일 삭제
      fs.unlinkSync(testPath);
      console.log('[Claude Desktop] 테스트 파일 삭제 성공');

      return true;
    } catch (error) {
      console.error('[Claude Desktop] 파일 접근 테스트 실패:', error);
      return false;
    }
  }
}
