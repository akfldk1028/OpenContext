// network/ResourceVerifier.ts
import { BaseMCPServer } from '../BaseMCPServer';

export class ResourceVerifier {
  private server: BaseMCPServer;

  constructor(server: BaseMCPServer) {
    this.server = server;
  }

  async verifyResourceClosed(
    checkFn: () => Promise<boolean>,
    resourceName: string,
    errorMessage: string,
    onRetryFn?: () => void
  ): Promise<void> {
    let attempts = 0;
    const maxAttempts = 3;
    const retryDelayMs = 500;

    while (attempts < maxAttempts) {
      try {
        const stillActive = await checkFn();

        if (!stillActive) {
          this.server.logInfo(`${resourceName} 닫힘 확인, 정상 종료됨`);
          break;
        }

        this.server.logInfo(`${resourceName} 아직 활성 상태, 재시도 대기 중...`);

        if (onRetryFn) {
          onRetryFn();
        }

        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        attempts++;
      } catch (error) {
        break; // 오류 발생 시 체크 중단
      }
    }

    if (attempts >= maxAttempts) {
      this.server.logError(errorMessage);
    }
  }
}
