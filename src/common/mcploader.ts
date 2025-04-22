import { loadMCPServers } from './configLoader';

// const servers = loadMCPServers('C:/.../claude_desktop_config.json');

// // 1) 전체 서버 이름 목록
// console.log('등록된 서버:', Array.from(servers.keys()));

// // 2) 특정 서버 개별 제어
// const n8n = servers.get('n8n');
// if (n8n) {
//   n8n.start();              // n8n 서버 켜기
//   const status = n8n.checkStatus();
//   console.log('n8n status:', status);
//   n8n.stop();               // n8n 서버 끄기
// }

// // 3) 모든 서버 일괄 상태 체크
// for (const [name, srv] of servers) {
//   const st = srv.checkStatus();
// //   console.log(`${name}:`, st.online ? 'online' : 'offline');
// }
