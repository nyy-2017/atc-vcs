import { Router } from 'express';
import { db, writeLog } from '../db.js';
import { fmt, sha256 } from '../util.js';

const router = Router();

router.get('/', (req, res) => {
  const { keyword = '' } = req.query;
  const where = keyword ? 'WHERE username LIKE ? OR real_name LIKE ?' : '';
  const args = keyword ? [`%${keyword}%`, `%${keyword}%`] : [];
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.real_name, u.role, u.position_id, u.phone, u.status, u.last_login, u.created_at, p.code AS position_code
       FROM users u LEFT JOIN positions p ON p.id = u.position_id ${where} ORDER BY u.id ASC`
    )
    .all(...args);
  res.json({ code: 0, data: rows });
});

router.post('/', (req, res) => {
  const b = req.body || {};
  if (!b.username || !b.real_name || !b.password) {
    return res.status(400).json({ code: 400, message: '用户名、姓名与初始密码为必填项' });
  }
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(b.username)) {
    return res.status(409).json({ code: 409, message: '用户名已存在' });
  }
  const info = db
    .prepare('INSERT INTO users (username, password, real_name, role, position_id, phone, status, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(b.username, sha256(b.password), b.real_name, b.role || 'controller', b.position_id ?? null, b.phone || '', b.status || 'active', fmt());
  writeLog({ user_name: req.user.real_name, module: '用户管理', action: '新增用户', detail: `创建用户 ${b.username}（${b.real_name}）`, ip: req.ip });
  res.json({ code: 0, data: { id: info.lastInsertRowid }, message: '用户创建成功' });
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const old = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!old) return res.status(404).json({ code: 404, message: '用户不存在' });
  const b = req.body || {};
  const fields = ['real_name', 'role', 'position_id', 'phone', 'status', 'password'];
  const sets = [];
  const args = [];
  for (const f of fields) {
    if (b[f] !== undefined && b[f] !== '') {
      sets.push(`${f} = ?`);
      args.push(f === 'password' ? sha256(b[f]) : f === 'position_id' ? (b[f] === null ? null : Number(b[f])) : b[f]);
    }
  }
  if (!sets.length) return res.status(400).json({ code: 400, message: '没有需要更新的字段' });
  args.push(id);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...args);
  writeLog({ user_name: req.user.real_name, module: '用户管理', action: '修改用户', detail: `更新用户 ${old.username}`, ip: req.ip });
  res.json({ code: 0, message: '用户已更新' });
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const old = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!old) return res.status(404).json({ code: 404, message: '用户不存在' });
  if (old.username === 'admin') return res.status(409).json({ code: 409, message: '内置管理员账号不可删除' });
  if (id === req.user.uid) return res.status(409).json({ code: 409, message: '不能删除当前登录账号' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  writeLog({ user_name: req.user.real_name, module: '用户管理', action: '删除用户', detail: `删除用户 ${old.username}`, ip: req.ip });
  res.json({ code: 0, message: '用户已删除' });
});

export default router;
