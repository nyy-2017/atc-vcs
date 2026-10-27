import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fmt, sha256, rand, sample } from './util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const DB_FILE = path.join(DATA_DIR, 'atc-vcs.db');

export const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initSchema() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    real_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'controller',
    position_id INTEGER,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    last_login TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    sector TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'main',
    default_channel_id INTEGER,
    headset TEXT NOT NULL DEFAULT 'normal',
    op_status TEXT NOT NULL DEFAULT 'offline',
    ip TEXT,
    operator TEXT,
    remark TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    freq REAL NOT NULL,
    band TEXT NOT NULL DEFAULT 'VHF',
    type TEXT NOT NULL DEFAULT 'primary',
    status TEXT NOT NULL DEFAULT 'idle',
    tx_power INTEGER NOT NULL DEFAULT 25,
    position_id INTEGER,
    coverage TEXT,
    squelch INTEGER NOT NULL DEFAULT 60,
    last_active TEXT,
    remark TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    call_no TEXT UNIQUE NOT NULL,
    position_id INTEGER,
    position_code TEXT,
    channel_id INTEGER,
    channel_code TEXT,
    freq REAL,
    operator TEXT,
    callsign TEXT,
    direction TEXT NOT NULL DEFAULT 'tx',
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    ptt_count INTEGER NOT NULL DEFAULT 0,
    quality INTEGER NOT NULL DEFAULT 95,
    audio_level INTEGER NOT NULL DEFAULT 0,
    remark TEXT
  );

  CREATE TABLE IF NOT EXISTS alarms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL DEFAULT 'minor',
    source TEXT,
    code TEXT,
    message TEXT NOT NULL,
    target TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    acked_by TEXT,
    acked_at TEXT
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_name TEXT,
    module TEXT,
    action TEXT,
    detail TEXT,
    ip TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hour TEXT NOT NULL,
    calls INTEGER NOT NULL DEFAULT 0,
    ptt INTEGER NOT NULL DEFAULT 0,
    busy_channels INTEGER NOT NULL DEFAULT 0,
    online_positions INTEGER NOT NULL DEFAULT 0,
    quality INTEGER NOT NULL DEFAULT 95
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_calls_start ON calls(start_time DESC);
  CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
  CREATE INDEX IF NOT EXISTS idx_alarms_status ON alarms(status);
  CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at DESC);
  `);
}

const POSITION_SEED = [
  { code: 'TWR-01', name: '塔台管制主用席', sector: '塔台', type: 'main', ip: '10.20.1.11' },
  { code: 'TWR-02', name: '塔台管制备份席', sector: '塔台', type: 'standby', ip: '10.20.1.12' },
  { code: 'APP-01', name: '进近管制主用席', sector: '进近', type: 'main', ip: '10.20.2.11' },
  { code: 'APP-02', name: '进近管制二席', sector: '进近', type: 'main', ip: '10.20.2.12' },
  { code: 'ACC-01', name: '区域管制 01 扇区', sector: '区调', type: 'main', ip: '10.20.3.11' },
  { code: 'ACC-02', name: '区域管制 02 扇区', sector: '区调', type: 'main', ip: '10.20.3.12' },
  { code: 'GND-01', name: '机坪管制席', sector: '机坪', type: 'main', ip: '10.20.4.11' },
  { code: 'SUP-01', name: '主任监督席', sector: '监控', type: 'supervisor', ip: '10.20.9.11' },
];

const CHANNEL_SEED = [
  { code: 'VHF-118.100', name: '塔台主用频率', freq: 118.1, type: 'primary', status: 'idle', tx_power: 25, coverage: '本场及 25NM' },
  { code: 'VHF-118.450', name: '塔台备用频率', freq: 118.45, type: 'standby', status: 'idle', tx_power: 25, coverage: '本场及 25NM' },
  { code: 'VHF-121.500', name: '国际应急频率', freq: 121.5, type: 'emergency', status: 'idle', tx_power: 50, coverage: '全覆盖' },
  { code: 'VHF-119.700', name: '进近主用频率', freq: 119.7, type: 'primary', status: 'busy', tx_power: 30, coverage: '60NM / FL200' },
  { code: 'VHF-120.350', name: '进近备用频率', freq: 120.35, type: 'standby', status: 'idle', tx_power: 30, coverage: '60NM / FL200' },
  { code: 'VHF-124.700', name: '区调 01 扇区频率', freq: 124.7, type: 'primary', status: 'idle', tx_power: 40, coverage: '200NM / FL460' },
  { code: 'VHF-125.900', name: '区调 02 扇区频率', freq: 125.9, type: 'primary', status: 'busy', tx_power: 40, coverage: '200NM / FL460' },
  { code: 'VHF-131.150', name: '机坪管制频率', freq: 131.15, type: 'primary', status: 'idle', tx_power: 15, coverage: '机坪区域' },
  { code: 'VHF-121.600', name: '地面滑行频率', freq: 121.6, type: 'primary', status: 'idle', tx_power: 15, coverage: '地面滑行道' },
  { code: 'VHF-130.000', name: '签派/公司频率', freq: 130.0, type: 'ground', status: 'idle', tx_power: 10, coverage: '航站楼' },
  { code: 'UHF-243.000', name: '军航应急频率', freq: 243.0, type: 'emergency', status: 'idle', tx_power: 50, coverage: '全覆盖' },
  { code: 'VHF-128.700', name: '情报通播 ATIS', freq: 128.7, type: 'primary', status: 'disabled', tx_power: 20, coverage: '本场 100NM' },
];

const CALLSIGNS = ['CCA1501', 'CSN3306', 'CES2199', 'CHH7205', 'CSC8842', 'CQH6610', 'CXA8283', 'CBJ5521', 'GCR7788', 'DKH1235'];
const OPERATORS = ['张明远', '李文博', '王思齐', '陈立群', '赵鹏', '孙晓辉', '周振宇'];

function seedUsers() {
  const rows = [
    { username: 'admin', password: 'admin123', real_name: '李振华', role: 'admin', phone: '13800000001', position: null },
    { username: 'supervisor', password: 'super123', real_name: '王振国', role: 'supervisor', phone: '13800000002', position: 8 },
    { username: 'controller', password: 'ctrl123', real_name: '张明远', role: 'controller', phone: '13800000003', position: 1 },
  ];
  const stmt = db.prepare(
    'INSERT INTO users (username, password, real_name, role, position_id, phone, status, created_at) VALUES (?,?,?,?,?,?,?,?)'
  );
  rows.forEach((u) => stmt.run(u.username, sha256(u.password), u.real_name, u.role, u.position, u.phone, 'active', fmt()));
}

function seedPositions() {
  // 席位与默认信道的对应关系（索引对应 CHANNEL_SEED 顺序 +1）
  const defaultChannels = [1, 2, 4, 5, 6, 7, 8, 1];
  const stmt = db.prepare(
    'INSERT INTO positions (code, name, sector, type, default_channel_id, headset, op_status, ip, operator, remark, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  );
  POSITION_SEED.forEach((p, i) => {
    stmt.run(
      p.code,
      p.name,
      p.sector,
      p.type,
      defaultChannels[i],
      'normal',
      p.type === 'standby' ? 'offline' : 'online',
      p.ip,
      p.type === 'supervisor' ? '王振国' : OPERATORS[i % OPERATORS.length],
      '',
      fmt()
    );
  });
}

function seedChannels() {
  const stmt = db.prepare(
    'INSERT INTO channels (code, name, freq, band, type, status, tx_power, position_id, coverage, squelch, last_active, remark, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
  );
  CHANNEL_SEED.forEach((c, i) => {
    stmt.run(
      c.code,
      c.name,
      c.freq,
      c.freq >= 200 ? 'UHF' : 'VHF',
      c.type,
      c.status,
      c.tx_power,
      i < 8 ? i + 1 : null,
      c.coverage,
      rand(55, 75),
      c.status === 'busy' ? fmt(new Date(Date.now() - rand(30, 300) * 1000)) : null,
      '',
      fmt()
    );
  });
}

function seedCalls() {
  const stmt = db.prepare(
    `INSERT INTO calls (call_no, position_id, position_code, channel_id, channel_code, freq, operator, callsign, direction, start_time, end_time, duration, status, ptt_count, quality, audio_level, remark)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  let seq = 1;
  const now = Date.now();
  for (let h = 23; h >= 0; h--) {
    const count = rand(4, 14);
    for (let k = 0; k < count; k++) {
      const pos = POSITION_SEED[rand(0, 6)];
      const ch = CHANNEL_SEED[rand(0, 8)];
      const dur = rand(4, 62);
      const startMs = now - h * 3600 * 1000 - rand(0, 3300) * 1000;
      const endMs = startMs + dur * 1000;
      const st = new Date(startMs);
      const en = new Date(endMs);
      const quality = rand(78, 100);
      stmt.run(
        `H${String(seq).padStart(5, '0')}`,
        POSITION_SEED.indexOf(pos) + 1,
        pos.code,
        CHANNEL_SEED.indexOf(ch) + 1,
        ch.code,
        ch.freq,
        OPERATORS[rand(0, OPERATORS.length - 1)],
        sample(CALLSIGNS),
        sample(['tx', 'tx', 'rx', 'duplex']),
        fmt(st),
        fmt(en),
        dur,
        Math.random() < 0.03 ? 'failed' : 'completed',
        Math.max(1, Math.round(dur / rand(4, 9))),
        quality,
        rand(30, 92),
        quality < 82 ? '链路质量偏低' : ''
      );
      seq++;
    }
  }
}

function seedAlarms() {
  const rows = [
    { level: 'major', source: '信道监测', code: 'CH-SWR-02', message: 'VHF-118.450 驻波比 1.92 超阈值', target: 'VHF-118.450', status: 'active', mins: 12 },
    { level: 'minor', source: '录音服务', code: 'REC-DISK-01', message: '录音存储剩余空间 18%，建议清理归档', target: '录音服务器', status: 'active', mins: 46 },
    { level: 'info', source: '席位管理', code: 'POS-LOGIN', message: 'APP-02 席位列登，已切换至备用链路', target: 'APP-02', status: 'cleared', mins: 92 },
    { level: 'critical', source: '供电监控', code: 'PWR-UPS-01', message: 'UPS-A 蓄电池组温度 41℃，已启动强制散热', target: 'UPS-A', status: 'acked', mins: 180 },
    { level: 'minor', source: '交换矩阵', code: 'MTX-PORT-07', message: '交换矩阵 07 端口出现 3 次丢包', target: 'MX-07', status: 'cleared', mins: 260 },
  ];
  const stmt = db.prepare(
    'INSERT INTO alarms (level, source, code, message, target, status, created_at, acked_by, acked_at) VALUES (?,?,?,?,?,?,?,?,?)'
  );
  rows.forEach((a) => {
    const at = fmt(new Date(Date.now() - a.mins * 60000));
    stmt.run(a.level, a.source, a.code, a.message, a.target, a.status, at, a.status === 'acked' ? '王振国' : null, a.status === 'acked' ? at : null);
  });
}

function seedLogs() {
  const rows = [
    { user: 'admin', module: '系统', action: '登录', detail: '管理员登录系统控制台', mins: 3 },
    { user: '张明远', module: '通信指挥台', action: '发起通话', detail: 'TWR-01 通过 VHF-118.450 呼叫 CCA1501', mins: 5 },
    { user: '王振国', module: '告警管理', action: '确认告警', detail: '确认供电监控 PWR-UPS-01 告警', mins: 26 },
    { user: '李文博', module: '信道管理', action: '修改信道', detail: 'VHF-119.700 发射功率 25W → 30W', mins: 58 },
    { user: 'admin', module: '用户管理', action: '新增用户', detail: '创建管制员账号 controller', mins: 120 },
    { user: '周振宇', module: '通信指挥台', action: '结束通话', detail: 'ACC-02 通话结束，时长 38s，质量 93', mins: 150 },
  ];
  const stmt = db.prepare('INSERT INTO logs (user_name, module, action, detail, ip, created_at) VALUES (?,?,?,?,?,?)');
  rows.forEach((r) => stmt.run(r.user, r.module, r.action, r.detail, `10.20.${rand(1, 9)}.${rand(20, 240)}`, fmt(new Date(Date.now() - r.mins * 60000))));
}

function seedMetrics() {
  const stmt = db.prepare('INSERT INTO metrics (hour, calls, ptt, busy_channels, online_positions, quality) VALUES (?,?,?,?,?,?)');
  for (let h = 23; h >= 0; h--) {
    const d = new Date(Date.now() - h * 3600 * 1000);
    const hour = `${String(d.getHours()).padStart(2, '0')}:00`;
    stmt.run(hour, rand(6, 26), rand(40, 180), rand(1, 5), rand(5, 7), rand(88, 99));
  }
}

export function seedIfEmpty() {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM users').get();
  if (c > 0) return false;
  seedUsers();
  seedPositions();
  seedChannels();
  seedCalls();
  seedAlarms();
  seedLogs();
  seedMetrics();
  const defaultSettings = {
    system_name: '空管语音通信交换系统',
    station: 'ZBAA 北京区域管制中心',
    auto_standby: 'true',
    record_days: '90',
    ptt_timeout: '30',
    alarm_sound: 'true',
    quality_threshold: '85',
  };
  const setStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)');
  for (const [k, v] of Object.entries(defaultSettings)) setStmt.run(k, v);
  return true;
}

export function nextCallSeq() {
  const { c } = db.prepare("SELECT COUNT(*) AS c FROM calls WHERE call_no LIKE 'C%'").get();
  return c + 1;
}

export function writeLog({ user_name, module, action, detail, ip }) {
  // 统一 IPv4 映射地址格式（::ffff:127.0.0.1 → 127.0.0.1）
  const rawIp = String(ip || '127.0.0.1').replace(/^::ffff:/, '');
  db.prepare('INSERT INTO logs (user_name, module, action, detail, ip, created_at) VALUES (?,?,?,?,?,?)').run(
    user_name || 'system',
    module || '系统',
    action || '',
    detail || '',
    rawIp === '::1' ? '127.0.0.1' : rawIp,
    fmt()
  );
}

export function pushAlarm({ level = 'minor', source, code, message, target }) {
  const info = db
    .prepare('INSERT INTO alarms (level, source, code, message, target, status, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(level, source, code, message, target, 'active', fmt());
  return db.prepare('SELECT * FROM alarms WHERE id = ?').get(info.lastInsertRowid);
}
