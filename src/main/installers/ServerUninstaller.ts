// import { spawn } from 'child_process';
// import logger from '../util';
//
// export class ServerInstaller {
//   async installServer(name: string, config: any) {
//     logger.info(`🔄 Installing server: ${name}`);
//     return new Promise<{ success: boolean }>(resolve => {
//       const cmd = spawn(config.cmd, config.args || []);
//       cmd.on('close', code => {
//         const ok = code === 0;
//         logger.info(ok ? `✅ Installed server: ${name}` : `❌ Installation failed: ${name}`);
//         resolve({ success: ok });
//       });
//     });
//   }
// }
