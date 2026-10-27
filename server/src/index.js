import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { initSchema, seedIfEmpty, db, writeLog, DB_FILE } from './db.js';
import { authRequired, SECRET } from './auth.js';
import { verifyToken } from './util.js';
import { addClient, clientCount } from './realtime.js';
import { startSimulator } from './simulator.js';

import authRoutes from './routes/auth.js';
import overviewRoutes from './routes/overview.js';
import positionRoutes from './routes/positions.js';
import channelRoutes from './routes/channels.js';
import callRoutes from './routes/calls.js';
import alarmRoutes from './routes/alarms.js';
import userRoutes from './routes/users.js';
import logRoutes from './routes/logs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);

initSchema();
const seeded = seedIfEmpty();
console.log(`[db] SQLite 数据库：${DB_FILE}${seeded ? '（已初始化演示数据）' : ''}`);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ code: 0, data: { status: 'UP', service: 'ATC-VCS', time: new Date().toISOString(), clients: clientCount() } });
});

// SSE 实时通道（EventSource 无法携带 Header，令牌通过 query 传递）
app.get('/api/stream', (req, res) => {
  const payload = verifyToken(String(req.query.token || ''), SECRET);
  if (!payload) return res.status(401).end();
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`event: ready\ndata: ${JSON.stringify({ ts: Date.now(), clients: clientCount() + 1 })}\n\n`);
  const remove = addClient(res);
  const cleanup = () => {
    remove();
    try {
      res.end();
    } catch {
      /* 已关闭 */
    }
  };
  req.on('close', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
});

app.use('/api/auth', authRoutes);

app.use('/api/overview', authRequired, overviewRoutes);
app.use('/api/positions', authRequired, positionRoutes);
app.use('/api/channels', authRequired, channelRoutes);
app.use('/api/calls', authRequired, callRoutes);
app.use('/api/alarms', authRequired, alarmRoutes);
app.use('/api/users', authRequired, userRoutes);
app.use('/api/logs', authRequired, logRoutes);

app.get('/api/settings', authRequired, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  res.json({ code: 0, data: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
});

app.put('/api/settings', authRequired, (req, res) => {
  const body = req.body || {};
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(body)) stmt.run(k, String(v));
  writeLog({ user_name: req.user.real_name, module: '系统设置', action: '修改配置', detail: `更新配置项 ${Object.keys(body).join('、')}`, ip: req.ip });
  res.json({ code: 0, message: '配置已保存' });
});

// 前端静态资源（构建后由后端一并托管，也可单独用 vite dev）
const distDir = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: 'index.html' }));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use('/api', (req, res) => res.status(404).json({ code: 404, message: '接口不存在' }));

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ code: status, message: err.message || '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`\n  空管语音通信交换系统 ATC-VCS`);
  console.log(`  ├─ 服务地址  http://localhost:${PORT}`);
  console.log(`  ├─ 接口前缀  /api`);
  console.log(`  └─ 数据库    server/data/atc-vcs.db\n`);
  startSimulator(Number(process.env.SIM_INTERVAL || 6000));
});
