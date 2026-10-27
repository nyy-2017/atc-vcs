import { Router } from 'express';
import { db, writeLog } from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const { page = 1, size = 20, keyword = '', module: mod = '', date = '' } = req.query;
  const where = [];
  const args = [];
  if (keyword) {
    where.push('(user_name LIKE ? OR action LIKE ? OR detail LIKE ?)');
    args.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (mod) {
    where.push('module = ?');
    args.push(mod);
  }
  if (date) {
    where.push('substr(created_at,1,10) = ?');
    args.push(date);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM logs ${clause}`).get(...args).c;
  const limit = Math.min(200, Math.max(1, Number(size)));
  const offset = (Math.max(1, Number(page)) - 1) * limit;
  const list = db.prepare(`SELECT * FROM logs ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...args, limit, offset);
  res.json({ code: 0, data: { list, total, page: Number(page), size: limit } });
});

router.delete('/', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ code: 403, message: '仅管理员可清理审计日志' });
  const before = db.prepare('SELECT COUNT(*) AS c FROM logs').get().c;
  db.prepare('DELETE FROM logs').run();
  writeLog({ user_name: req.user.real_name, module: '日志审计', action: '清理日志', detail: `清理 ${before} 条审计日志`, ip: req.ip });
  res.json({ code: 0, message: '日志已清理' });
});

export default router;
