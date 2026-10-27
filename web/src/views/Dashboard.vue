<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  AlertOutlined,
  AudioOutlined,
  ApiOutlined,
  HeartOutlined,
  HistoryOutlined,
  TeamOutlined,
} from '@ant-design/icons-vue';
import { api } from '../api';
import { onRealtime, realtimeState } from '../api/realtime';
import { ALARM_LEVEL, CALL_STATUS, DIRECTION, fmtDur, qualityColor, timeOnly } from '../utils/dict';
import StatCard from '../components/StatCard.vue';
import StatusBadge from '../components/StatusBadge.vue';
import EChart from '../components/EChart.vue';

const router = useRouter();
const loading = ref(true);
const data = ref(null);
const activeCalls = ref([]);
const now = ref(Date.now());
let offs = [];
let lastReload = 0;
let clockTimer = null;
let poller = null;

async function load(silent = false) {
  if (!silent) loading.value = true;
  try {
    const [ov, ac] = await Promise.all([api.overview(), api.calls.active()]);
    data.value = ov.data;
    activeCalls.value = ac.data;
    lastReload = Date.now();
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

const stats = computed(() => data.value?.stats || {});
const trend = computed(() => data.value?.trend || []);
const alarms = computed(() => data.value?.recentAlarms || []);
const logs = computed(() => data.value?.recentLogs || []);
// 监控表：进行中的通话优先，空位用最近完成的通话补齐
const liveRows = computed(() => {
  const active = activeCalls.value || [];
  const activeIds = new Set(active.map((c) => c.id));
  const done = (data.value?.recentCalls || []).filter((c) => !activeIds.has(c.id));
  return [...active, ...done].slice(0, 6);
});

const health = computed(() => {
  const s = stats.value;
  return {
    score: s.healthScore || 0,
    color: s.healthScore >= 90 ? '#0fae9a' : s.healthScore >= 75 ? '#f0a020' : '#e8453c',
    label: s.healthScore >= 90 ? '运行良好' : s.healthScore >= 75 ? '存在风险' : '需要干预',
  };
});

const trendOption = computed(() => {
  const hours = trend.value.map((t) => t.hour);
  return {
    grid: { left: 44, right: 46, top: 34, bottom: 26 },
    tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#e4ebf5', textStyle: { color: '#16233a', fontSize: 12 } },
    legend: { right: 0, top: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: '#5c6b85', fontSize: 11 } },
    xAxis: {
      type: 'category',
      data: hours,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#e4ebf5' } },
      axisTick: { show: false },
      axisLabel: { color: '#8d9bb2', fontSize: 11, interval: 2 },
    },
    yAxis: [
      {
        type: 'value',
        splitLine: { lineStyle: { color: '#f0f5fc' } },
        axisLabel: { color: '#8d9bb2', fontSize: 11 },
      },
      {
        type: 'value',
        splitLine: { show: false },
        axisLabel: { color: '#8d9bb2', fontSize: 11 },
      },
    ],
    series: [
      {
        name: '通话次数',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        data: trend.value.map((t) => t.calls),
        itemStyle: { color: '#1d5cf6' },
        lineStyle: { width: 2.2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(29,92,246,0.24)' },
              { offset: 1, color: 'rgba(29,92,246,0.01)' },
            ],
          },
        },
      },
      {
        name: 'PTT 次数',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        symbol: 'none',
        data: trend.value.map((t) => t.ptt),
        itemStyle: { color: '#0fae9a' },
        lineStyle: { width: 1.8, type: 'dashed' },
      },
    ],
  };
});

const channelOption = computed(() => {
  const s = stats.value;
  const idle = Math.max(0, (s.totalChannels || 0) - (s.busyChannels || 0) - (s.faultChannels || 0) - (s.disabledChannels || 0));
  const items = [
    { name: '空闲', value: idle, color: '#0fae9a' },
    { name: '占用中', value: s.busyChannels || 0, color: '#1d5cf6' },
    { name: '故障', value: s.faultChannels || 0, color: '#e8453c' },
    { name: '停用', value: s.disabledChannels || 0, color: '#c9d4e5' },
  ];
  return {
    tooltip: { trigger: 'item', backgroundColor: '#fff', borderColor: '#e4ebf5', textStyle: { color: '#16233a', fontSize: 12 } },
    series: [
      {
        type: 'pie',
        radius: ['62%', '82%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: { borderColor: '#fff', borderWidth: 3, borderRadius: 4 },
        label: {
          show: true,
          position: 'center',
          formatter: `{a|${s.totalChannels || 0}}\n{b|信道总数}`,
          rich: {
            a: { fontSize: 26, fontWeight: 700, color: '#16233a', lineHeight: 32 },
            b: { fontSize: 11, color: '#8d9bb2' },
          },
        },
        emphasis: { label: { show: true } },
        data: items.map((i) => ({ ...i, itemStyle: { color: i.color } })),
      },
    ],
  };
});

const sectorOption = computed(() => {
  const list = data.value?.sectorLoad || [];
  return {
    grid: { left: 54, right: 26, top: 12, bottom: 18 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#fff', borderColor: '#e4ebf5', textStyle: { color: '#16233a', fontSize: 12 } },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#f0f5fc' } },
      axisLabel: { color: '#8d9bb2', fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: list.map((i) => i.sector),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#5c6b85', fontSize: 12 },
    },
    series: [
      {
        type: 'bar',
        data: list.map((i) => i.calls),
        barWidth: 12,
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: '#7ba1ff' },
              { offset: 1, color: '#1d5cf6' },
            ],
          },
        },
        label: { show: true, position: 'right', color: '#5c6b85', fontSize: 11 },
      },
    ],
  };
});

const elapsed = (c) => {
  const start = new Date(String(c.start_time).replace(' ', 'T')).getTime();
  const s = Math.max(0, Math.round((now.value - start) / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const callColumns = [
  { title: '通话编号', dataIndex: 'call_no', key: 'call_no', width: 110 },
  { title: '席位', dataIndex: 'position_code', key: 'position_code', width: 82 },
  { title: '信道', dataIndex: 'channel_code', key: 'channel_code', width: 112 },
  { title: '呼号', dataIndex: 'callsign', key: 'callsign', width: 84 },
  { title: '方向', dataIndex: 'direction', key: 'direction', width: 66 },
  { title: '持续', key: 'elapsed', width: 74 },
  { title: '质量', dataIndex: 'quality', key: 'quality', width: 70 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 84 },
];

onMounted(() => {
  load();
  poller = setInterval(() => load(true), 10000);
  clockTimer = setInterval(() => (now.value = Date.now()), 1000);
  offs.push(
    onRealtime('call', () => {
      if (Date.now() - lastReload > 1500) load(true);
    }),
    onRealtime('alarm', () => {
      if (Date.now() - lastReload > 1500) load(true);
    })
  );
});

onBeforeUnmount(() => {
  clearInterval(poller);
  clearInterval(clockTimer);
  offs.forEach((fn) => fn());
});
</script>

<template>
  <a-spin :spinning="loading" wrapper-class-name="dash-spin">
    <div class="grid" style="gap: 14px">
      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px">
        <StatCard label="今日通话" :value="stats.todayCalls || 0" unit="次" :foot="`累计 ${stats.totalCalls || 0} 条记录`" tone="blue" :icon="AudioOutlined" />
        <StatCard label="活动通话" :value="stats.activeCalls || 0" unit="路" foot="实时语音链路" tone="teal" :icon="HistoryOutlined" />
        <StatCard label="在位席位" :value="`${stats.onlinePositions || 0}/${stats.totalPositions || 0}`" foot="管制席位在线情况" tone="blue" :icon="TeamOutlined" />
        <StatCard label="占用信道" :value="`${stats.busyChannels || 0}/${stats.totalChannels || 0}`" :foot="`故障 ${stats.faultChannels || 0} · 停用 ${stats.disabledChannels || 0}`" tone="amber" :icon="ApiOutlined" />
        <StatCard label="平均语音质量" :value="stats.avgQuality || 0" unit="分" :foot="`今日 PTT ${stats.todayPtt || 0} 次`" tone="teal" :icon="HeartOutlined" />
        <StatCard label="待处理告警" :value="stats.activeAlarms || 0" unit="条" :foot="`其中紧急 ${stats.criticalAlarms || 0} 条`" :tone="stats.criticalAlarms ? 'red' : 'amber'" :icon="AlertOutlined" />
      </div>

      <div class="grid" style="grid-template-columns: minmax(0, 1.85fr) minmax(300px, 1fr)">
        <div class="panel">
          <div class="panel-head">
            <div class="t">24 小时话音业务趋势</div>
            <span class="soft-badge gray">每 10 秒自动刷新</span>
          </div>
          <div class="panel-body" style="padding-top: 6px">
            <EChart :option="trendOption" height="252px" />
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><div class="t">信道状态分布</div></div>
          <div class="panel-body" style="padding: 4px 16px 12px">
            <EChart :option="channelOption" height="186px" />
            <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px">
              <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--atc-text-2)">
                <span class="dot" style="background: #0fae9a" /> 空闲
                <b class="num" style="margin-left: auto">{{ (stats.totalChannels || 0) - (stats.busyChannels || 0) - (stats.faultChannels || 0) - (stats.disabledChannels || 0) }}</b>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--atc-text-2)">
                <span class="dot" style="background: #1d5cf6" /> 占用
                <b class="num" style="margin-left: auto">{{ stats.busyChannels || 0 }}</b>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--atc-text-2)">
                <span class="dot" style="background: #e8453c" /> 故障
                <b class="num" style="margin-left: auto">{{ stats.faultChannels || 0 }}</b>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--atc-text-2)">
                <span class="dot" style="background: #c9d4e5" /> 停用
                <b class="num" style="margin-left: auto">{{ stats.disabledChannels || 0 }}</b>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid" style="grid-template-columns: minmax(0, 1.85fr) minmax(300px, 1fr)">
        <div class="panel">
          <div class="panel-head">
            <div class="t">实时通话监控</div>
            <a-button type="link" size="small" @click="router.push('/console')">进入指挥台 →</a-button>
          </div>
          <div class="panel-body" style="padding: 0 6px 6px">
            <a-table
              :columns="callColumns"
              :data-source="liveRows"
              :pagination="false"
              size="small"
              row-key="id"
              :scroll="{ x: 640 }"
              :locale="{ emptyText: '当前没有进行中的通话' }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'callsign'">
                  <span class="mono">{{ record.callsign || '—' }}</span>
                </template>
                <template v-else-if="column.key === 'channel_code'">
                  <span class="mono">{{ record.channel_code }}</span>
                </template>
                <template v-else-if="column.key === 'direction'">
                  {{ DIRECTION[record.direction]?.icon }} {{ DIRECTION[record.direction]?.label }}
                </template>
                <template v-else-if="column.key === 'elapsed'">
                  <span
                    class="mono"
                    :style="record.status === 'active' ? { color: '#e8453c', fontWeight: 600 } : { color: 'var(--atc-text-3)' }"
                  >
                    {{ record.status === 'active' ? elapsed(record) : fmtDur(record.duration || 0) }}
                  </span>
                </template>
                <template v-else-if="column.key === 'quality'">
                  <span class="num" :style="{ color: qualityColor(record.quality), fontWeight: 600 }">{{ record.quality }}</span>
                </template>
                <template v-else-if="column.key === 'status'">
                  <StatusBadge
                    :label="CALL_STATUS[record.status]?.label"
                    :tone="CALL_STATUS[record.status]?.cls"
                    dot
                    :dot-color="record.status === 'active' ? '#1d5cf6' : '#a8b4c8'"
                  />
                </template>
              </template>
            </a-table>
            <div
              style="
                display: flex;
                align-items: center;
                justify-content: space-around;
                padding: 11px 8px 4px;
                margin: 0 10px;
                border-top: 1px solid var(--atc-border-2);
                font-size: 11.5px;
                color: var(--atc-text-3);
              "
            >
              <div>今日通话 <b class="num" style="color: #16233a; font-size: 13px">{{ stats.todayCalls || 0 }}</b> 次</div>
              <div>PTT 合计 <b class="num" style="color: #16233a; font-size: 13px">{{ stats.todayPtt || 0 }}</b> 次</div>
              <div>累计时长 <b class="num" style="color: #16233a; font-size: 13px">{{ fmtDur(stats.todayDuration || 0) }}</b></div>
            </div>
          </div>
        </div>

        <div class="grid" style="gap: 14px; align-content: start">
          <div class="panel">
            <div class="panel-head"><div class="t">系统健康度</div></div>
            <div class="panel-body" style="display: flex; align-items: center; gap: 16px">
              <a-progress
                type="circle"
                :percent="health.score"
                :size="92"
                :stroke-color="health.color"
                :stroke-width="9"
                trail-color="#eff4fb"
              >
                <div style="font-size: 22px; font-weight: 700; color: #16233a">{{ health.score }}</div>
                <div style="font-size: 10px; color: #8d9bb2">HEALTH</div>
              </a-progress>
              <div style="flex: 1; font-size: 12px; color: var(--atc-text-2); line-height: 2.1">
                <div>
                  运行状态
                  <b :style="{ color: health.color, float: 'right' }">{{ health.label }}</b>
                </div>
                <div>
                  交换矩阵负载
                  <b style="float: right">{{ Math.min(99, (stats.busyChannels || 0) * 12 + 34) }}%</b>
                </div>
                <div>
                  录音存储
                  <b style="float: right">82%</b>
                </div>
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <div class="t">最新告警</div>
              <a-button type="link" size="small" @click="router.push('/alarms')">全部 →</a-button>
            </div>
            <div class="panel-body" style="padding: 8px 16px 12px">
              <div v-if="!alarms.length" class="empty-hint">暂无告警</div>
              <div v-for="a in alarms" :key="a.id" class="event-line" style="align-items: flex-start">
                <span class="soft-badge" :class="ALARM_LEVEL[a.level]?.cls" style="flex: 0 0 auto">{{ ALARM_LEVEL[a.level]?.label }}</span>
                <div style="flex: 1; min-width: 0">
                  <div style="line-height: 1.5">{{ a.message }}</div>
                  <div style="color: var(--atc-text-3); font-size: 11px; margin-top: 3px">{{ a.source }} · {{ timeOnly(a.created_at) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid" style="grid-template-columns: minmax(280px, 1fr) minmax(0, 1.85fr)">
        <div class="panel">
          <div class="panel-head"><div class="t">今日扇区通话分布</div></div>
          <div class="panel-body" style="padding: 8px 12px 10px">
            <EChart :option="sectorOption" height="196px" />
          </div>
        </div>

        <div class="panel">
          <div class="panel-head">
            <div class="t">最近操作日志</div>
            <a-button type="link" size="small" @click="router.push('/logs')">查看全部 →</a-button>
          </div>
          <div class="panel-body" style="padding: 10px 16px 12px">
            <div v-for="l in logs" :key="l.id" class="event-line">
              <span class="event-time mono">{{ timeOnly(l.created_at) }}</span>
              <span class="soft-badge blue" style="flex: 0 0 auto">{{ l.module }}</span>
              <span style="color: var(--atc-text-2); flex: 1">{{ l.detail }}</span>
              <span style="color: var(--atc-text-3); flex: 0 0 auto">{{ l.user_name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </a-spin>
</template>
