import { Router } from 'express';
import { db } from '../db.js';
import { fmtDate } from '../util.js';

const router = Router();

const one = (sql, ...args) => db.prepare(sql).get(...args) || {};

router.get('/', (req, res) => {
  const today = fmtDate();

  const positions = db.prepare('SELECT * FROM positions').all();
  const channels = db.prepare('SELECT * FROM channels').all();
  const onlinePositions = positions.filter((p) => p.op_status !== 'offline').length;
  const busyChannels = channels.filter((c) => c.status === 'busy').length;
  const faultChannels = channels.filter((c) => c.status === 'fault').length;
  const disabledChannels = channels.filter((c) => c.status === 'disabled').length;

  const todayStat = one(
    `SELECT COUNT(*) AS calls, COALESCE(SUM(ptt_count),0) AS ptt, COALESCE(AVG(quality),0) AS quality, COALESCE(SUM(duration),0) AS duration
     FROM calls WHERE substr(start_time,1,10) = ?`,
    today
  );
  const totalStat = one('SELECT COUNT(*) AS calls FROM calls');
  const activeCalls = one("SELECT COUNT(*) AS c FROM calls WHERE status = 'active'");
  const alarms = db.prepare("SELECT * FROM alarms WHERE status != 'cleared' ORDER BY created_at DESC").all();
  const criticalAlarms = alarms.filter((a) => a.level === 'critical').length;

  // 近 24 小时通话趋势
  const rows = db
    .prepare(
      `SELECT substr(start_time,1,13) AS bucket, COUNT(*) AS calls, COALESCE(SUM(ptt_count),0) AS ptt, COALESCE(AVG(quality),0) AS quality
       FROM calls WHERE start_time >= datetime('now','localtime','-24 hours') GROUP BY bucket`
    )
    .all();
  const map = new Map(rows.map((r) => [r.bucket, r]));
  const trend = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(Date.now() - i * 3600 * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}`;
    const hit = map.get(key);
    trend.push({
      hour: `${String(d.getHours()).padStart(2, '0')}:00`,
      calls: hit ? hit.calls : 0,
      ptt: hit ? hit.ptt : 0,
      quality: hit ? Number(hit.quality.toFixed(1)) : 0,
    });
  }

  // 信道负载（今日通话次数）
  const channelLoad = db
    .prepare(
      `SELECT channel_code AS code, channel_id AS id, COUNT(*) AS calls FROM calls
       WHERE substr(start_time,1,10) = ? GROUP BY channel_code ORDER BY calls DESC LIMIT 8`
    )
    .all(today);

  // 扇区通话分布
  const sectorLoad = db
    .prepare(
      `SELECT p.sector AS sector, COUNT(*) AS calls FROM calls c JOIN positions p ON p.id = c.position_id
       WHERE substr(c.start_time,1,10) = ? GROUP BY p.sector ORDER BY calls DESC`
    )
    .all(today);

  const recentCalls = db.prepare('SELECT * FROM calls ORDER BY start_time DESC LIMIT 8').all();
  const recentAlarms = db.prepare('SELECT * FROM alarms ORDER BY created_at DESC LIMIT 6').all();
  const recentLogs = db.prepare('SELECT * FROM logs ORDER BY created_at DESC LIMIT 8').all();

  const healthScore = Math.max(
    60,
    Math.min(
      100,
      100 -
        criticalAlarms * 6 -
        (alarms.filter((a) => a.level === 'major').length) * 3 -
        faultChannels * 4 -
        (positions.length - onlinePositions) * 1
    )
  );

  res.json({
    code: 0,
    data: {
      station: 'ZBAA 北京区域管制中心',
      serverTime: new Date().toISOString(),
      stats: {
        totalPositions: positions.length,
        onlinePositions,
        totalChannels: channels.length,
        busyChannels,
        faultChannels,
        disabledChannels,
        todayCalls: todayStat.calls || 0,
        totalCalls: totalStat.calls || 0,
        activeCalls: activeCalls.c || 0,
        todayPtt: todayStat.ptt || 0,
        todayDuration: todayStat.duration || 0,
        avgQuality: Number((todayStat.quality || 0).toFixed(1)),
        activeAlarms: alarms.length,
        criticalAlarms,
        healthScore,
      },
      trend,
      channelLoad,
      sectorLoad,
      recentCalls,
      recentAlarms,
      recentLogs,
    },
  });
});

export default router;
