/* eslint import/prefer-default-export: off */
import { URL } from 'url';
import path from 'path';

export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 1212;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
}


import log from 'electron-log';
// 파일과 콘솔에 모두 출력, 다양한 이모지 활용 🔧🐛
log.transports.file.level = 'info';
log.transports.console.level = 'info';

const logger = log;
export default logger;



import fs from 'fs';

