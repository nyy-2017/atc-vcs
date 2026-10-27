import { db, writeLog } from './db.js';
import { fmt, makeCallNo, rand } from './util.js';
import { broadcast } from './realtime.js';

const parseTime = (s) => new Date(String(s).replace(' ', 'T')).getTime();

function nextSeq() {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM calls').get();
  return c + 1;
}

/** 发起一路语音通话：占用信道 + 席位置忙 */
export function startCall({ positionId, channelId, direction = 'tx', callsign = '', operator = '系统' }) {
  const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(Number(positionId));
  if (!position) {
    const err = new Error('席位不存在');
    err.status = 404;
    throw err;
  }
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(Number(channelId));
  if (!channel) {
    const err = new Error('信道不存在');
    err.status = 404;
    throw err;
  }
  if (channel.status === 'fault') {
    const err = new Error(`信道 ${channel.code} 处于故障状态，无法发起通话`);
    err.status = 409;
    throw err;
  }
  if (channel.status === 'disabled') {
    const err = new Error(`信道 ${channel.code} 已停用`);
    err.status = 409;
    throw err;
  }
  const occupied = db.prepare("SELECT id FROM calls WHERE channel_id = ? AND status = 'active'").get(channel.id);
  if (occupied) {
    const err = new Error(`信道 ${channel.code} 正在被占用，请等待或切换备用频率`);
    err.status = 409;
    throw err;
  }

  const callNo = makeCallNo(nextSeq());
  const info = db
    .prepare(
      `INSERT INTO calls (call_no, position_id, position_code, channel_id, channel_code, freq, operator, callsign, direction, start_time, duration, status, ptt_count, quality, audio_level)
       VALUES (?,?,?,?,?,?,?,?,?,?,0,'active',1,?,?)`
    )
    .run(
      callNo,
      position.id,
      position.code,
      channel.id,
      channel.code,
      channel.freq,
      operator,
      callsign || '',
      direction,
      fmt(),
      rand(90, 99),
      rand(40, 85)
    );

  db.prepare("UPDATE channels SET status = 'busy', last_active = ? WHERE id = ?").run(fmt(), channel.id);
  db.prepare("UPDATE positions SET op_status = 'busy' WHERE id = ?").run(position.id);

  const call = db.prepare('SELECT * FROM calls WHERE id = ?').get(info.lastInsertRowid);
  writeLog({
    user_name: operator,
    module: '通信指挥台',
    action: '发起通话',
    detail: `${position.code} 通过 ${channel.code}（${channel.freq} MHz）建立${direction === 'duplex' ? '双向' : '单向'}通话`,
  });
  broadcast('call', { action: 'start', data: call });
  return call;
}

/** 结束通话：释放信道、回落质量评分 */
export function endCall(id, { operator } = {}) {
  const call = db.prepare('SELECT * FROM calls WHERE id = ?').get(Number(id));
  if (!call) {
    const err = new Error('通话记录不存在');
    err.status = 404;
    throw err;
  }
  if (call.status !== 'active') return call;

  const duration = Math.max(1, Math.round((Date.now() - parseTime(call.start_time)) / 1000));
  const quality = Math.min(100, Math.max(72, call.quality - rand(0, 4)));
  db.prepare("UPDATE calls SET end_time = ?, duration = ?, status = 'completed', quality = ? WHERE id = ?").run(
    fmt(),
    duration,
    quality,
    call.id
  );
  db.prepare("UPDATE channels SET status = 'idle' WHERE id = ? AND status = 'busy'").run(call.channel_id);
  db.prepare("UPDATE positions SET op_status = 'online' WHERE id = ? AND op_status = 'busy'").run(call.position_id);

  const row = db.prepare('SELECT * FROM calls WHERE id = ?').get(call.id);
  writeLog({
    user_name: operator || call.operator || 'system',
    module: '通信指挥台',
    action: '结束通话',
    detail: `${call.position_code} 通话结束，时长 ${duration}s，质量 ${quality}`,
  });
  broadcast('call', { action: 'end', data: row });
  return row;
}

/** PTT 按键计数，同时刷新音频电平 */
export function pttOnce(id) {
  const call = db.prepare('SELECT * FROM calls WHERE id = ?').get(Number(id));
  if (!call) {
    const err = new Error('通话记录不存在');
    err.status = 404;
    throw err;
  }
  db.prepare('UPDATE calls SET ptt_count = ptt_count + 1, audio_level = ? WHERE id = ?').run(rand(55, 95), call.id);
  return db.prepare('SELECT * FROM calls WHERE id = ?').get(call.id);
}
