import { Router } from 'express';
import { db, writeLog } from '../db.js';
import { sha256, signToken, fmt } from '../util.js';
import { SECRET, authRequired } from '../auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '请输入用户名与密码' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).trim());
  if (!user || user.password !== sha256(password)) {
    return res.status(401).json({ code: 401, message: '用户名或密码错误' });
  }
  if (user.status !== 'active') {
    return res.status(403).json({ code: 403, message: '该账号已被停用，请联系管理员' });
  }
  db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(fmt(), user.id);
  const token = signToken(
    { uid: user.id, username: user.username, role: user.role, real_name: user.real_name, exp: Date.now() + 12 * 3600 * 1000 },
    SECRET
  );
  writeLog({
    user_name: user.real_name,
    module: '系统',
    action: '登录',
    detail: `${user.real_name}（${user.role}）登录系统控制台`,
    ip: req.ip,
  });
  res.json({
    code: 0,
    data: {
      token,
      user: { id: user.id, username: user.username, real_name: user.real_name, role: user.role, position_id: user.position_id },
    },
  });
});

router.get('/me', authRequired, (req, res) => {
  const user = db
    .prepare('SELECT id, username, real_name, role, position_id, phone, last_login FROM users WHERE id = ?')
    .get(req.user.uid);
  res.json({ code: 0, data: user });
});

router.post('/logout', authRequired, (req, res) => {
  writeLog({ user_name: req.user.real_name, module: '系统', action: '退出', detail: '用户退出登录', ip: req.ip });
  res.json({ code: 0, message: '已退出登录' });
});

export default router;
