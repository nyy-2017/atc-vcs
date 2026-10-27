const BASE = '/api';
const TOKEN_KEY = 'atc_vcs_token';
const USER_KEY = 'atc_vcs_user';

export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};
export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
};
export const setUser = (u) => localStorage.setItem(USER_KEY, JSON.stringify(u));

function qs(params) {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.append(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function request(path, { method = 'GET', body, params, blob = false } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(BASE + path + qs(params), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('无法连接服务端，请确认后端服务已启动（端口 3001）');
  }

  if (res.status === 401) {
    clearToken();
    if (!location.pathname.endsWith('/login')) location.href = '/login';
    throw new Error('登录状态已失效，请重新登录');
  }

  if (blob) {
    if (!res.ok) throw new Error('文件下载失败');
    return res.blob();
  }

  const json = await res.json().catch(() => ({ code: res.status, message: '响应解析失败' }));
  if (!res.ok || json.code !== 0) throw new Error(json.message || `请求失败（${res.status}）`);
  return json;
}

export const api = {
  login: (body) => request('/auth/login', { method: 'POST', body }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  overview: () => request('/overview'),

  channels: {
    list: (params) => request('/channels', { params }),
    create: (body) => request('/channels', { method: 'POST', body }),
    update: (id, body) => request(`/channels/${id}`, { method: 'PUT', body }),
    remove: (id) => request(`/channels/${id}`, { method: 'DELETE' }),
  },
  positions: {
    list: (params) => request('/positions', { params }),
    create: (body) => request('/positions', { method: 'POST', body }),
    update: (id, body) => request(`/positions/${id}`, { method: 'PUT', body }),
    remove: (id) => request(`/positions/${id}`, { method: 'DELETE' }),
  },
  calls: {
    list: (params) => request('/calls', { params }),
    active: () => request('/calls/active'),
    detail: (id) => request(`/calls/${id}`),
    start: (body) => request('/calls/start', { method: 'POST', body }),
    ptt: (id) => request(`/calls/${id}/ptt`, { method: 'POST' }),
    end: (id) => request(`/calls/${id}/end`, { method: 'POST' }),
    remove: (id) => request(`/calls/${id}`, { method: 'DELETE' }),
    exportCsv: () => request('/calls/export', { blob: true }),
  },
  alarms: {
    list: (params) => request('/alarms', { params }),
    create: (body) => request('/alarms', { method: 'POST', body }),
    ack: (id) => request(`/alarms/${id}/ack`, { method: 'POST' }),
    clear: (id) => request(`/alarms/${id}/clear`, { method: 'POST' }),
    remove: (id) => request(`/alarms/${id}`, { method: 'DELETE' }),
  },
  users: {
    list: (params) => request('/users', { params }),
    create: (body) => request('/users', { method: 'POST', body }),
    update: (id, body) => request(`/users/${id}`, { method: 'PUT', body }),
    remove: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  },
  logs: {
    list: (params) => request('/logs', { params }),
    clear: () => request('/logs', { method: 'DELETE' }),
  },
  settings: {
    get: () => request('/settings'),
    save: (body) => request('/settings', { method: 'PUT', body }),
  },
};
