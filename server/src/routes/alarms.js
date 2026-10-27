import { Router } from 'express';
import { db, writeLog, pushAlarm } from '../db.js';
import { fmt } from '../util.js';
import { broadcast } from '../realtime.js';

const router = Router();

router.get('/', (req, res) => {
  const { level = '', status = '', keyword = '', page = 1, size = 20 } = req.query;
  const where = [];
  const args = [];
  if (level) {
    where.push('level = ?');
    args.push(level);
  }
  if (status) {
    where.push('status = ?');
    args.push(status);
  }
  if (keyword) {
    where.push('(message LIKE ? OR source LIKE ? OR code LIKE ?)');
    args.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM alarms ${clause}`).get(...args).c;
  const limit = Math.min(100, Math.max(1, Number(size)));
  const offset = (Math.max(1, Number(page)) - 1) * limit;
  const list = db.prepare(`SELECT * FROM alarms ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...args, limit, offset);
  const summary = {
    critical: db.prepare("SELECT COUNT(*) AS c FROM alarms WHERE level='critical' AND status!='cleared'").get().c,
    major: db.prepare("SELECT COUNT(*) AS c FROM alarms WHERE level='major' AND status!='cleared'").get().c,
    minor: db.prepare("SELECT COUNT(*) AS c FROM alarms WHERE level='minor' AND status!='cleared'").get().c,
    info: db.prepare("SELECT COUNT(*) AS c FROM alarms WHERE level='info' AND status!='cleared'").get().c,
  };
  res.json({ code: 0, data: { list, total, page: Number(page), size: limit, summary } });
});

router.post('/', (req, res) => {
  const { level = 'minor', source = '人工上报', code = 'MANUAL', message, target = '' } = req.body || {};
  if (!message) return res.status(400).json({ code: 400, message: '告警内容不能为空' });
  const row = pushAlarm({ level, source, code, message, target });
  writeLog({ user_name: req.user.real_name, module: '告警管理', action: '上报告警', detail: message, ip: req.ip });
  broadcast('alarm', { action: 'create', data: row });
  res.json({ code: 0, data: row, message: '告警已上报' });
});

router.post('/:id/ack', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM alarms WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ code: 404, message: '告警不存在' });
  db.prepare("UPDATE alarms SET status = 'acked', acked_by = ?, acked_at = ? WHERE id = ?").run(req.user.real_name, fmt(), id);
  writeLog({ user_name: req.user.real_name, module: '告警管理', action: '确认告警', detail: row.message, ip: req.ip });
  broadcast('alarm', { action: 'ack', data: { id } });
  res.json({ code: 0, data: db.prepare('SELECT * FROM alarms WHERE id = ?').get(id), message: '告警已确认' });
});

router.post('/:id/clear', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM alarms WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ code: 404, message: '告警不存在' });
  db.prepare("UPDATE alarms SET status = 'cleared', acked_by = COALESCE(acked_by, ?), acked_at = COALESCE(acked_at, ?) WHERE id = ?").run(
    req.user.real_name,
    fmt(),
    id
  );
  writeLog({ user_name: req.user.real_name, module: '告警管理', action: '清除告警', detail: row.message, ip: req.ip });
  broadcast('alarm', { action: 'clear', data: { id } });
  res.json({ code: 0, message: '告警已清除' });
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM alarms WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ code: 404, message: '告警不存在' });
  db.prepare('DELETE FROM alarms WHERE id = ?').run(id);
  writeLog({ user_name: req.user.real_name, module: '告警管理', action: '删除告警', detail: row.message, ip: req.ip });
  res.json({ code: 0, message: '告警已删除' });
});

export default router;
