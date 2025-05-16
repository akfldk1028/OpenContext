import express from 'express';
import bodyParser from 'body-parser';
import { manager } from './managerInstance';
import * as readline from "node:readline";
import {metadataCache} from "@/main/preloadMetadata"; // manager 이미 공유된거


export function startExpressServer() {
  const apiApp = express();
  apiApp.use(bodyParser.json());

  apiApp.post('/request-server-metadata', async (req, res) => {
    const { serverName } = req.body;

    const cached = metadataCache[serverName];
    if (cached) {
      return res.json({ success: true, metadata: cached });
    }

    return res.status(404).json({ success: false, error: 'Metadata not found (preload 실패했거나 서버 꺼짐)' });
  });

  apiApp.listen(5010, () => {
    console.log('📡 Electron API 서버가 5010 포트에서 시작되었습니다.');
  });
}
