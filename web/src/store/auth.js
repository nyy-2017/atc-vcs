import { defineStore } from 'pinia';
import { api, clearToken, getToken, getUser, setToken, setUser } from '../api';
import { connectRealtime, disconnectRealtime } from '../api/realtime';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: getToken(),
    user: getUser(),
    loading: false,
  }),
  getters: {
    isLogin: (s) => Boolean(s.token),
    isAdmin: (s) => s.user?.role === 'admin',
    displayName: (s) => s.user?.real_name || s.user?.username || '未登录',
    roleLabel: (s) => ({ admin: '系统管理员', supervisor: '主任管制员', controller: '管制员' }[s.user?.role] || '—'),
  },
  actions: {
    async login(form) {
      this.loading = true;
      try {
        const res = await api.login(form);
        this.token = res.data.token;
        this.user = res.data.user;
        setToken(this.token);
        setUser(this.user);
        connectRealtime(this.token);
        return res.data.user;
      } finally {
        this.loading = false;
      }
    },
    async logout() {
      try {
        await api.logout();
      } catch {
        /* 忽略退出接口异常 */
      }
      this.token = '';
      this.user = null;
      clearToken();
      disconnectRealtime();
    },
    restore() {
      if (this.token) connectRealtime(this.token);
    },
  },
});
