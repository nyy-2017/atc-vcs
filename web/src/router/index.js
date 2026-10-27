import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from '../api';

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/Login.vue'), meta: { public: true, title: '登录' } },
  {
    path: '/',
    component: () => import('../layouts/BasicLayout.vue'),
    children: [
      { path: '', redirect: '/dashboard' },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { title: '运行总览', subtitle: 'VOICE SWITCHING OVERVIEW', icon: 'dashboard' },
      },
      {
        path: 'console',
        name: 'console',
        component: () => import('../views/Console.vue'),
        meta: { title: '通信指挥台', subtitle: 'LIVE OPERATION CONSOLE', icon: 'console' },
      },
      {
        path: 'channels',
        name: 'channels',
        component: () => import('../views/Channels.vue'),
        meta: { title: '信道频率管理', subtitle: 'RADIO CHANNEL MANAGEMENT', icon: 'channels' },
      },
      {
        path: 'positions',
        name: 'positions',
        component: () => import('../views/Positions.vue'),
        meta: { title: '席位管理', subtitle: 'CONTROLLER POSITIONS', icon: 'positions' },
      },
      {
        path: 'calls',
        name: 'calls',
        component: () => import('../views/Calls.vue'),
        meta: { title: '通话记录', subtitle: 'CALL RECORDS & RECORDING', icon: 'calls' },
      },
      {
        path: 'alarms',
        name: 'alarms',
        component: () => import('../views/Alarms.vue'),
        meta: { title: '告警中心', subtitle: 'ALARM CENTER', icon: 'alarms' },
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('../views/Users.vue'),
        meta: { title: '用户与权限', subtitle: 'USERS & PERMISSIONS', icon: 'users' },
      },
      {
        path: 'logs',
        name: 'logs',
        component: () => import('../views/Logs.vue'),
        meta: { title: '操作日志', subtitle: 'AUDIT LOGS', icon: 'logs' },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('../views/Settings.vue'),
        meta: { title: '系统设置', subtitle: 'SYSTEM SETTINGS', icon: 'settings' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach((to) => {
  const hasToken = Boolean(getToken());
  if (!to.meta.public && !hasToken) return { path: '/login', query: { redirect: to.fullPath } };
  if (to.path === '/login' && hasToken) return { path: '/dashboard' };
  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · 空管语音通信交换系统` : '空管语音通信交换系统';
});

export default router;
