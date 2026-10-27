<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import {
  AlertOutlined,
  ApiOutlined,
  AudioOutlined,
  DashboardOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LogoutOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
  BellOutlined,
} from '@ant-design/icons-vue';
import { useAuthStore } from '../store/auth';
import { api } from '../api';
import { onRealtime, realtimeState } from '../api/realtime';
import { ALARM_LEVEL, timeOnly } from '../utils/dict';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const clock = ref('');
const alarmCount = ref(0);
const alarmList = ref([]);
let timer = null;
let poller = null;
let offs = [];

const menus = [
  { key: '/dashboard', label: '运行总览', icon: DashboardOutlined },
  { key: '/console', label: '通信指挥台', icon: AudioOutlined },
  { key: '/channels', label: '信道频率', icon: ApiOutlined },
  { key: '/positions', label: '席位管理', icon: TeamOutlined },
  { key: '/calls', label: '通话记录', icon: HistoryOutlined },
  { key: '/alarms', label: '告警中心', icon: AlertOutlined },
  { key: '/users', label: '用户权限', icon: UserOutlined },
  { key: '/logs', label: '操作日志', icon: FileTextOutlined },
  { key: '/settings', label: '系统设置', icon: SettingOutlined },
];

const selectedKeys = computed(() => [route.path]);
const title = computed(() => route.meta.title || '运行总览');
const subtitle = computed(() => route.meta.subtitle || '');

function tickClock() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  clock.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

async function loadAlarms() {
  try {
    const res = await api.alarms.list({ status: 'active', size: 5 });
    alarmCount.value = res.data.total;
    alarmList.value = res.data.list;
  } catch {
    /* 静默 */
  }
}

async function handleLogout() {
  await auth.logout();
  message.success('已安全退出');
  router.replace('/login');
}

onMounted(() => {
  tickClock();
  timer = setInterval(tickClock, 1000);
  loadAlarms();
  poller = setInterval(loadAlarms, 30000);
  if (!realtimeState.connected) auth.restore();
  offs.push(onRealtime('alarm', loadAlarms));
});

onBeforeUnmount(() => {
  clearInterval(timer);
  clearInterval(poller);
  offs.forEach((fn) => fn());
});
</script>

<template>
  <div class="app-shell">
    <aside class="side">
      <div class="brand">
        <div class="brand-badge">ATC</div>
        <div>
          <div class="brand-title">空管语音通信<br />交换系统</div>
          <div class="brand-sub">Voice Switching</div>
        </div>
      </div>

      <div class="side-menu">
        <a-menu :selected-keys="selectedKeys" mode="inline" style="border: none" @click="({ key }) => router.push(key)">
          <a-menu-item v-for="m in menus" :key="m.key">
            <template #icon><component :is="m.icon" /></template>
            <span>{{ m.label }}</span>
          </a-menu-item>
        </a-menu>
      </div>

      <div class="side-foot">
        <div style="display: flex; align-items: center; gap: 6px">
          <span class="dot" :style="{ background: realtimeState.connected ? '#0fae9a' : '#8d9bb2' }" :class="{ pulse: realtimeState.connected }" />
          {{ realtimeState.connected ? '实时链路已连接' : '实时链路未连接' }}
        </div>
        <div>版本 v1.0.0 · 内网部署</div>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div>
          <div class="topbar-title">{{ title }}</div>
          <div class="topbar-sub">{{ subtitle }}</div>
        </div>

        <div class="topbar-right">
          <span class="live-pill" :class="{ off: !realtimeState.connected }">
            <ThunderboltOutlined />
            {{ realtimeState.connected ? 'LIVE' : 'OFFLINE' }}
          </span>
          <span class="clock mono">{{ clock }}</span>

          <a-popover placement="bottomRight" trigger="click" :overlay-style="{ width: '340px' }">
            <template #content>
              <div style="max-height: 280px; overflow-y: auto">
                <div v-if="!alarmList.length" class="empty-hint">暂无待处理告警</div>
                <div v-for="a in alarmList" :key="a.id" class="event-line" style="align-items: flex-start">
                  <span class="soft-badge" :class="ALARM_LEVEL[a.level]?.cls">{{ ALARM_LEVEL[a.level]?.label }}</span>
                  <div style="flex: 1; min-width: 0">
                    <div style="line-height: 1.5">{{ a.message }}</div>
                    <div style="color: var(--atc-text-3); font-size: 11px; margin-top: 2px">{{ a.source }} · {{ timeOnly(a.created_at) }}</div>
                  </div>
                </div>
              </div>
              <a-button block type="link" size="small" @click="router.push('/alarms')">进入告警中心</a-button>
            </template>
            <a-badge :count="alarmCount" :offset="[-2, 4]" size="small" style="margin-right: 14px">
              <a-button type="text" shape="circle"><BellOutlined style="font-size: 16px" /></a-button>
            </a-badge>
          </a-popover>

          <a-dropdown placement="bottomRight">
            <div style="display: flex; align-items: center; gap: 8px; cursor: pointer">
              <a-avatar :size="30" style="background: #eaf1ff; color: #1d5cf6; font-weight: 600">
                {{ auth.displayName.slice(0, 1) }}
              </a-avatar>
              <div style="line-height: 1.3">
                <div style="font-size: 12.5px; font-weight: 600">{{ auth.displayName }}</div>
                <div v-if="auth.roleLabel !== auth.displayName" style="font-size: 10.5px; color: var(--atc-text-3)">{{ auth.roleLabel }}</div>
              </div>
            </div>
            <template #overlay>
              <a-menu>
                <a-menu-item key="logout" @click="handleLogout">
                  <LogoutOutlined /> 退出登录
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </header>

      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>
