import { Router } from 'express';
import { db, writeLog } from '../db.js';
import { fmt, fmtDate } from '../util.js';
import { broadcast } from '../realtime.js';

const router = Router();

function decorate(rows) {
  const today = fmtDate();
  const counts = new Map(
    db
      .prepare(
        `SELECT channel_id AS id, COUNT(*) AS c FROM calls WHERE substr(start_time,1,10) = ? GROUP BY channel_id`
      )
      .all(today)
      .map((r) => [r.id, r.c])
  );
  return rows.map((r) => ({ ...r, calls_today: counts.get(r.id) || 0 }));
}

router.get('/', (req, res) => {
  const { keyword = '', status = '', type = '' } = req.query;
  const where = [];
  const args = [];
  if (keyword) {
    where.push('(code LIKE ? OR name LIKE ? OR CAST(freq AS TEXT) LIKE ?)');
    args.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (status) {
    where.push('status = ?');
    args.push(status);
  }
  if (type) {
    where.push('type = ?');
    args.push(type);
  }
  const sql = `SELECT * FROM channels ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY freq ASC`;
  res.json({ code: 0, data: decorate(db.prepare(sql).all(...args)) });
});

router.post('/', (req, res) => {
  const b = req.body || {};
  if (!b.code || !b.name || !b.freq) return res.status(400).json({ code: 400, message: '信道编号、名称、频率为必填项' });
  const exists = db.prepare('SELECT id FROM channels WHERE code = ?').get(b.code);
  if (exists) return res.status(409).json({ code: 409, message: `信道编号 ${b.code} 已存在` });
  const info = db
    .prepare(
      `INSERT INTO channels (code, name, freq, band, type, status, tx_power, position_id, coverage, squelch, remark, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      b.code,
      b.name,
      Number(b.freq),
      b.band || (Number(b.freq) >= 200 ? 'UHF' : 'VHF'),
      b.type || 'primary',
      b.status || 'idle',
      Number(b.tx_power ?? 25),
      b.position_id ?? null,
      b.coverage || '',
      Number(b.squelch ?? 60),
      b.remark || '',
      fmt()
    );
  writeLog({ user_name: req.user.real_name, module: '信道管理', action: '新增信道', detail: `新增 ${b.code}（${b.freq} MHz）`, ip: req.ip });
  const row = db.prepare('SELECT * FROM channels WHERE id = ?').get(info.lastInsertRowid);
  broadcast('channel', { action: 'create', id: row.id });
  res.json({ code: 0, data: row, message: '信道创建成功' });
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const old = db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
  if (!old) return res.status(404).json({ code: 404, message: '信道不存在' });
  const b = req.body || {};
  const fields = ['code', 'name', 'freq', 'band', 'type', 'status', 'tx_power', 'position_id', 'coverage', 'squelch', 'remark'];
  const sets = [];
  const args = [];
  for (const f of fields) {
    if (b[f] !== undefined) {
      sets.push(`${f} = ?`);
      args.push(f === 'freq' || f === 'tx_power' || f === 'squelch' ? Number(b[f]) : b[f]);
    }
  }
  if (!sets.length) return res.status(400).json({ code: 400, message: '没有需要更新的字段' });
  args.push(id);
  db.prepare(`UPDATE channels SET ${sets.join(', ')} WHERE id = ?`).run(...args);
  writeLog({
    user_name: req.user.real_name,
    module: '信道管理',
    action: '修改信道',
    detail: `更新 ${old.code} 信道配置`,
    ip: req.ip,
  });
  broadcast('channel', { action: 'update', id });
  res.json({ code: 0, data: db.prepare('SELECT * FROM channels WHERE id = ?').get(id), message: '信道已更新' });
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const old = db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
  if (!old) return res.status(404).json({ code: 404, message: '信道不存在' });
  if (old.status === 'busy') return res.status(409).json({ code: 409, message: '信道正在通话中，无法删除' });
  db.prepare('DELETE FROM channels WHERE id = ?').run(id);
  writeLog({ user_name: req.user.real_name, module: '信道管理', action: '删除信道', detail: `删除信道 ${old.code}`, ip: req.ip });
  broadcast('channel', { action: 'delete', id });
  res.json({ code: 0, message: '信道已删除' });
});

export default router;
