// src/common/types/server-config.ts
export interface ServerInstallationConfig {
    type: 'git' | 'docker' | 'npm' | 'local';
    source?: string;           // Git 저장소 URL
    branch?: string;           // Git 브랜치
    tag?: string;              // Docker 태그나 Git 태그
    installDir?: string;       // 로컬 설치 경로
    installCommand?: string;   // 설치 명령어
    dockerImage?: string;      // Docker 이미지
    dockerComposeFile?: string; // docker-compose 파일 경로
    requirements?: {           // 필수 요구사항 (도커, 노드 등)
      docker?: boolean;
      node?: string;           // 노드 버전 요구사항
      npm?: string;            // npm 버전 요구사항
    };
  }
  
  export interface MCPServerConfigExtended {
    name: string;               // 서버 표시 이름
    description: string;        // 서버 설명
    icon?: string;              // 아이콘 경로
    category?: string;          // 서버 카테고리 (AI, 개발, 데이터베이스 등)
    version?: string;           // 서버 버전
    installation: ServerInstallationConfig;
    command: string;            // 실행 명령어
    args: string[];             // 명령어 인자
    env?: { [key: string]: string }; // 환경 변수
    host?: string;              // 원격 호스트
    port?: number;              // 서버 포트
    healthCheckUrl?: string;    // 상태 체크 URL
    logsPath?: string;          // 로그 파일 경로
    autoStart?: boolean;        // 앱 시작시 자동 실행 여부
  }