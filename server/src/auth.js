import { verifyToken } from './util.js';

export const SECRET = process.env.ATC_SECRET || 'atc-vcs-secret-2026';

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer\s+/i, '');
  const payload = verifyToken(token, SECRET);
  if (!payload) {
    return res.status(401).json({ code: 401, message: '登录状态已失效，请重新登录' });
  }
  req.user = payload;
  next();
}
