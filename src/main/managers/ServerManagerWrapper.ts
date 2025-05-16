// managers/ServerManagerWrapper.ts
import { BrowserWindow } from 'electron';



let mainWindowRef: BrowserWindow | null = null;
export function setMainWindow(win: BrowserWindow) {
  mainWindowRef = win;
}
export function sendServerLogToRenderer(message: string) {
  if (mainWindowRef) {
    mainWindowRef.webContents.send('server-log', message);
  }
}
