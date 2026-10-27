import { Router } from 'express';
import { db, writeLog } from '../db.js';
import { fmt, fmtDate } from '../util.js';
import { broadcast } from '../realtime.js';

const router = Router();

function decorate(rows) {
  const today = fmtDate();
  const counts = new Map(
    db
      .prepare(`SELECT position_id AS id, COUNT(*) AS c FROM calls WHERE substr(start_time,1,10) = ? GROUP BY position_id`)
      .all(today)
      .map((r) => [r.id, r.c])
  );
  return rows.map((r) => ({ ...r, calls_today: counts.get(r.id) || 0 }));
}

router.get('/', (req, res) => {
  const { keyword = '', sector = '', op_status = '' } = req.query;
  const where = [];
  const args = [];
  if (keyword) {
    where.push('(code LIKE ? OR name LIKE ? OR operator LIKE ?)');
    args.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (sector) {
    where.push('sector = ?');
    args.push(sector);
  }
  if (op_status) {
    where.push('op_status = ?');
    args.push(op_status);
  }
  const sql = `SELECT * FROM positions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id ASC`;
  res.json({ code: 0, data: decorate(db.prepare(sql).all(...args)) });
});

router.post('/', (req, res) => {
  const b = req.body || {};
  if (!b.code || !b.name || !b.sector) return res.status(400).json({ code: 400, message: '席位编号、名称、所属扇区为必填项' });
  if (db.prepare('SELECT id FROM positions WHERE code = ?').get(b.code)) {
    return res.status(409).json({ code: 409, message: `席位编号 ${b.code} 已存在` });
  }
  const info = db
    .prepare(
      `INSERT INTO positions (code, name, sector, type, default_channel_id, headset, op_status, ip, operator, remark, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      b.code,
      b.name,
      b.sector,
      b.type || 'main',
      b.default_channel_id ?? null,
      b.headset || 'normal',
      b.op_status || 'offline',
      b.ip || '',
      b.operator || '',
      b.remark || '',
      fmt()
    );
  writeLog({ user_name: req.user.real_name, module: '席位管理', action: '新增席位', detail: `新增席位 ${b.code} ${b.name}`, ip: req.ip });
  const row = db.prepare('SELECT * FROM positions WHERE id = ?').get(info.lastInsertRowid);
  broadcast('position', { action: 'create', id: row.id });
  res.json({ code: 0, data: row, message: '席位创建成功' });
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const old = db.prepare('SELECT * FROM positions WHERE id = ?').get(id);
  if (!old) return res.status(404).json({ code: 404, message: '席位不存在' });
  const b = req.body || {};
  const fields = ['code', 'name', 'sector', 'type', 'default_channel_id', 'headset', 'op_status', 'ip', 'operator', 'remark'];
  const sets = [];
  const args = [];
  for (const f of fields) {
    if (b[f] !== undefined) {
      sets.push(`${f} = ?`);
      args.push(f === 'default_channel_id' ? (b[f] === null ? null : Number(b[f])) : b[f]);
    }
  }
  if (!sets.length) return res.status(400).json({ code: 400, message: '没有需要更新的字段' });
  args.push(id);
  db.prepare(`UPDATE positions SET ${sets.join(', ')} WHERE id = ?`).run(...args);
  writeLog({ user_name: req.user.real_name, module: '席位管理', action: '修改席位', detail: `更新席位 ${old.code}`, ip: req.ip });
  broadcast('position', { action: 'update', id });
  res.json({ code: 0, data: db.prepare('SELECT * FROM positions WHERE id = ?').get(id), message: '席位已更新' });
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const old = db.prepare('SELECT * FROM positions WHERE id = ?').get(id);
  if (!old) return res.status(404).json({ code: 404, message: '席位不存在' });
  if (db.prepare("SELECT id FROM calls WHERE position_id = ? AND status = 'active'").get(id)) {
    return res.status(409).json({ code: 409, message: '该席位存在进行中的通话，无法删除' });
  }
  db.prepare('DELETE FROM positions WHERE id = ?').run(id);
  writeLog({ user_name: req.user.real_name, module: '席位管理', action: '删除席位', detail: `删除席位 ${old.code}`, ip: req.ip });
  broadcast('position', { action: 'delete', id });
  res.json({ code: 0, message: '席位已删除' });
});

export default router;
