import { db, pushAlarm } from './db.js';
import { startCall, endCall } from './callService.js';
import { broadcast } from './realtime.js';
import { rand, sample } from './util.js';

const CALLSIGNS = ['CCA1501', 'CSN3306', 'CES2199', 'CHH7205', 'CSC8842', 'CQH6610', 'CXA8283', 'CBJ5521', 'GCR7788', 'DKH1235', 'CSZ9821', 'CHB4410'];
const ALARM_POOL = [
  { level: 'minor', source: '信道监测', code: 'CH-VSWR', message: '天线驻波比短时超阈值' },
  { level: 'minor', source: '交换矩阵', code: 'MTX-JIT', message: '交换矩阵端口抖动 12ms' },
  { level: 'major', source: '链路监测', code: 'LNK-DLY', message: '主备链路时延差超过 80ms' },
  { level: 'info', source: '录音服务', code: 'REC-SYNC', message: '录音文件完成归档同步' },
  { level: 'minor', source: '席位管理', code: 'POS-HEAD', message: '席位耳机阻抗异常' },
];

let timer = null;

function tick() {
  const active = db.prepare("SELECT * FROM calls WHERE status = 'active'").all();

  // 1. 刷新活动通话的音频电平
  for (const c of active) {
    db.prepare('UPDATE calls SET audio_level = ? WHERE id = ?').run(rand(35, 95), c.id);
  }

  // 2. 结束部分通话（模拟陆空通话自然结束）
  const now = Date.now();
  for (const c of active) {
    const started = new Date(String(c.start_time).replace(' ', 'T')).getTime();
    const dur = (now - started) / 1000;
    if (dur > 28 && Math.random() < 0.5) {
      try {
        endCall(c.id, { operator: c.operator });
      } catch {
        /* ignore */
      }
    }
  }

  // 3. 新通话呼入
  const activeCount = db.prepare("SELECT COUNT(*) AS c FROM calls WHERE status = 'active'").get().c;
  if (activeCount < 3 && Math.random() < 0.35) {
    const positions = db.prepare("SELECT * FROM positions WHERE op_status != 'offline' AND code != 'SUP-01'").all();
    const channels = db.prepare("SELECT * FROM channels WHERE status = 'idle'").all();
    if (positions.length && channels.length) {
      const p = sample(positions);
      const c = sample(channels);
      try {
        startCall({
          positionId: p.id,
          channelId: c.id,
          direction: sample(['tx', 'tx', 'duplex']),
          callsign: sample(CALLSIGNS),
          operator: p.operator || '管制员',
        });
      } catch {
        /* 信道被抢占时忽略 */
      }
    }
  }

  // 4. 偶发告警
  if (Math.random() < 0.025) {
    const a = sample(ALARM_POOL);
    const ch = sample(db.prepare('SELECT * FROM channels').all());
    const row = pushAlarm({ ...a, message: `${ch ? ch.code + ' ' : ''}${a.message}`, target: ch ? ch.code : '系统' });
    broadcast('alarm', { action: 'create', data: row });
  }

  broadcast('tick', {
    ts: Date.now(),
    activeCalls: db.prepare("SELECT COUNT(*) AS c FROM calls WHERE status = 'active'").get().c,
    busyChannels: db.prepare("SELECT COUNT(*) AS c FROM channels WHERE status='busy'").get().c,
    activeAlarms: db.prepare("SELECT COUNT(*) AS c FROM alarms WHERE status='active'").get().c,
  });
}

export function startSimulator(intervalMs = 6000) {
  if (timer) return;
  timer = setInterval(() => {
    try {
      tick();
    } catch (e) {
      console.error('[simulator]', e.message);
    }
  }, intervalMs);
  timer.unref?.();
  console.log(`[simulator] 通信流模拟引擎已启动，心跳 ${intervalMs}ms`);
}

export function stopSimulator() {
  if (timer) clearInterval(timer);
  timer = null;
}
