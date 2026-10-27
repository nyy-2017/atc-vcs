import crypto from 'node:crypto';

const pad = (n) => String(n).padStart(2, '0');

/** 本地时间格式化：YYYY-MM-DD HH:mm:ss */
export function fmt(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function nowMs() {
  return Date.now();
}

/** 通话呼号：C + yyMMdd + 4 位序号 */
export function makeCallNo(seq) {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  return `C${yy}${pad(d.getMonth() + 1)}${pad(d.getDate())}${String(seq % 10000).padStart(4, '0')}`;
}

export function sha256(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

/** 极简签名令牌：base64(payload).hmac */
export function signToken(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expect = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (sig !== expect) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export const pick = (obj, keys) => {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
};

export const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
export const sample = (arr) => arr[Math.floor(Math.random() * arr.length)];
