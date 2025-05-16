// src/main/preloadMetadata.ts
import { manager } from './managerInstance';

export const metadataCache: { [serverName: string]: any } = {};

export async function preloadMetadataForServer(serverName: string) {
  const server = manager.getServer(serverName);

  if (!server || !server.processHandle) {
    console.warn(`[Preload] 서버 '${serverName}'가 실행 중이 아님. preload 실패`);
    return;
  }

  const proc = server.processHandle;

  try {
    const request = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "get_metadata",
    }) + "\n";

    proc.stdin.write(request);

    const response = await new Promise<string>((resolve, reject) => {
      proc.stdout.once('data', (data) => {
        resolve(data.toString());
      });

      setTimeout(() => reject(new Error('Timeout waiting for metadata')), 10000); // 10초로 늘리기
    });


    const parsed = JSON.parse(response);

    metadataCache[serverName] = parsed.result;  // ✨ 성공하면 저장
    console.log(`[Preload] '${serverName}' metadata preload 완료`);
  } catch (err) {
    console.error(`[Preload] '${serverName}' metadata preload 실패`, err);
  }
}
