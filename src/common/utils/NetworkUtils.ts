import * as net from 'net';
export const NetworkUtils = {
  // 호스트와 포트로 TCP 연결을 시도하여 열려 있으면 true 반환
  checkPortOpen: (host: string, port: number, timeout: number = 1000): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      let isOpen = false;
      socket.setTimeout(timeout);
      socket.once('connect', () => {
        isOpen = true;
        socket.destroy();
      });
      socket.once('error', () => {
        // 에러 발생 시 포트 닫힘 혹은 연결 불가
      });
      socket.once('timeout', () => {
        // 타임아웃 시에도 연결 불가로 간주
      });
      socket.once('close', () => {
        resolve(isOpen);
      });
      socket.connect(port, host);
    });
  },

    pingHost: async (host: string): Promise<boolean> => {
    // 예시: DNS 조회 또는 TCP 80 연결 시도로 대체 가능
    try {
      const result = await NetworkUtils.checkPortOpen(host, 80, 500);
      return result;
    } catch {
      return false;
    }
  }
};
