export const CHANNEL_STATUS = {
  idle: { label: '空闲', cls: 'teal', dot: '#0fae9a' },
  busy: { label: '占用中', cls: 'blue', dot: '#1d5cf6' },
  fault: { label: '故障', cls: 'red', dot: '#e8453c' },
  disabled: { label: '停用', cls: 'gray', dot: '#8d9bb2' },
};

export const CHANNEL_TYPE = {
  primary: { label: '主用频率', cls: 'blue' },
  standby: { label: '备用频率', cls: 'teal' },
  emergency: { label: '应急频率', cls: 'red' },
  ground: { label: '地面/签派', cls: 'amber' },
};

export const POSITION_STATUS = {
  online: { label: '在位', cls: 'teal', dot: '#0fae9a' },
  busy: { label: '通话中', cls: 'blue', dot: '#1d5cf6' },
  offline: { label: '离位', cls: 'gray', dot: '#8d9bb2' },
};

export const POSITION_TYPE = {
  main: { label: '主用席', cls: 'blue' },
  standby: { label: '备用席', cls: 'teal' },
  supervisor: { label: '主任席', cls: 'amber' },
};

export const CALL_STATUS = {
  active: { label: '通话中', cls: 'blue' },
  completed: { label: '已完成', cls: 'teal' },
  failed: { label: '异常中断', cls: 'red' },
};

export const DIRECTION = {
  tx: { label: '发话', icon: '↑' },
  rx: { label: '收听', icon: '↓' },
  duplex: { label: '双向', icon: '⇅' },
};

export const ALARM_LEVEL = {
  critical: { label: '紧急', cls: 'red', color: '#e8453c' },
  major: { label: '重要', cls: 'amber', color: '#f0a020' },
  minor: { label: '次要', cls: 'blue', color: '#1d5cf6' },
  info: { label: '提示', cls: 'gray', color: '#8d9bb2' },
};

export const ALARM_STATUS = {
  active: { label: '待处理', cls: 'red' },
  acked: { label: '已确认', cls: 'amber' },
  cleared: { label: '已清除', cls: 'teal' },
};

export const ROLE = {
  admin: { label: '系统管理员', cls: 'red' },
  supervisor: { label: '主任管制员', cls: 'amber' },
  controller: { label: '管制员', cls: 'blue' },
};

export const USER_STATUS = {
  active: { label: '启用', cls: 'teal' },
  disabled: { label: '停用', cls: 'gray' },
};

export const SECTORS = ['塔台', '进近', '区调', '机坪', '监控', '应急'];

export const BANDS = ['VHF', 'UHF', 'HF'];

export function fmtDur(sec) {
  const s = Number(sec) || 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(r).padStart(2, '0')}s`;
  return `${r}s`;
}

export function fmtClock(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export function parseTime(str) {
  if (!str) return null;
  return new Date(String(str).replace(' ', 'T'));
}

export function timeOnly(str) {
  if (!str) return '--:--:--';
  return String(str).slice(11) || str;
}

export function qualityColor(q) {
  if (q >= 92) return '#0fae9a';
  if (q >= 84) return '#1d5cf6';
  if (q >= 76) return '#f0a020';
  return '#e8453c';
}
