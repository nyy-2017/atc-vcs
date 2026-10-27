import { Router } from 'express';
import { db, writeLog } from '../db.js';
import { fmt } from '../util.js';
import { broadcast } from '../realtime.js';
import { startCall, endCall, pttOnce } from '../callService.js';

const router = Router();

router.get('/active', (req, res) => {
  const rows = db.prepare("SELECT * FROM calls WHERE status = 'active' ORDER BY start_time ASC").all();
  const now = Date.now();
  const data = rows.map((r) => ({
    ...r,
    elapsed: Math.max(0, Math.round((now - new Date(String(r.start_time).replace(' ', 'T')).getTime()) / 1000)),
  }));
  res.json({ code: 0, data });
});

router.get('/export', (req, res) => {
  const rows = db.prepare('SELECT * FROM calls ORDER BY start_time DESC LIMIT 5000').all();
  const head = ['通话编号', '席位', '信道', '频率(MHz)', '管制员', '航班呼号', '方向', '开始时间', '结束时间', '时长(s)', 'PTT次数', '质量分', '状态'];
  const dirMap = { tx: '发话', rx: '收听', duplex: '双向' };
  const lines = [head.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.call_no,
        r.position_code,
        r.channel_code,
        r.freq,
        r.operator,
        r.callsign,
        dirMap[r.direction] || r.direction,
        r.start_time,
        r.end_time || '',
        r.duration,
        r.ptt_count,
        r.quality,
        r.status,
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
  }
  writeLog({ user_name: req.user.real_name, module: '通话记录', action: '导出记录', detail: `导出 ${rows.length} 条通话记录`, ip: req.ip });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="atc-calls.csv"');
  res.send('\uFEFF' + lines.join('\r\n'));
});

router.get('/', (req, res) => {
  const { page = 1, size = 10, keyword = '', status = '', position_code = '', channel_code = '', date_from = '', date_to = '' } = req.query;
  const where = [];
  const args = [];
  if (keyword) {
    where.push('(call_no LIKE ? OR callsign LIKE ? OR operator LIKE ?)');
    args.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (status) {
    where.push('status = ?');
    args.push(status);
  }
  if (position_code) {
    where.push('position_code = ?');
    args.push(position_code);
  }
  if (channel_code) {
    where.push('channel_code = ?');
    args.push(channel_code);
  }
  if (date_from) {
    where.push('start_time >= ?');
    args.push(`${date_from} 00:00:00`);
  }
  if (date_to) {
    where.push('start_time <= ?');
    args.push(`${date_to} 23:59:59`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM calls ${clause}`).get(...args).c;
  const limit = Math.min(200, Math.max(1, Number(size)));
  const offset = (Math.max(1, Number(page)) - 1) * limit;
  const rows = db.prepare(`SELECT * FROM calls ${clause} ORDER BY start_time DESC LIMIT ? OFFSET ?`).all(...args, limit, offset);
  res.json({ code: 0, data: { list: rows, total, page: Number(page), size: limit } });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM calls WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ code: 404, message: '通话记录不存在' });
  const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(row.position_id);
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(row.channel_id);
  res.json({ code: 0, data: { ...row, position, channel } });
});

router.post('/start', (req, res) => {
  const { positionId, channelId, direction = 'tx', callsign = '' } = req.body || {};
  if (!positionId || !channelId) return res.status(400).json({ code: 400, message: '请选择席位与信道' });
  const call = startCall({ positionId, channelId, direction, callsign, operator: req.user.real_name });
  res.json({ code: 0, data: call, message: '通话已建立' });
});

router.post('/:id/ptt', (req, res) => {
  const row = pttOnce(req.params.id);
  broadcast('call', { action: 'ptt', data: row });
  res.json({ code: 0, data: row });
});

router.post('/:id/end', (req, res) => {
  const row = endCall(req.params.id, { operator: req.user.real_name });
  res.json({ code: 0, data: row, message: '通话已结束' });
});

router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM calls WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ code: 404, message: '通话记录不存在' });
  if (row.status === 'active') return res.status(409).json({ code: 409, message: '进行中的通话无法删除，请先结束通话' });
  db.prepare('DELETE FROM calls WHERE id = ?').run(row.id);
  writeLog({ user_name: req.user.real_name, module: '通话记录', action: '删除记录', detail: `删除通话记录 ${row.call_no}`, ip: req.ip });
  broadcast('call', { action: 'delete', data: { id: row.id } });
  res.json({ code: 0, message: '记录已删除' });
});

export default router;
