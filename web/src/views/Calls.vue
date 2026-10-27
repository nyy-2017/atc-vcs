<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { DownloadOutlined, PlayCircleFilled, PauseCircleFilled, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { api } from '../api';
import { onRealtime } from '../api/realtime';
import { CALL_STATUS, DIRECTION, fmtDur, qualityColor, timeOnly } from '../utils/dict';
import StatusBadge from '../components/StatusBadge.vue';

const list = ref([]);
const positions = ref([]);
const channels = ref([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const filters = reactive({ keyword: '', status: undefined, position_code: undefined, channel_code: undefined, range: [] });

const drawer = reactive({ open: false, loading: false });
const detail = ref(null);
const playing = ref(false);
const progress = ref(0);
const now = ref(Date.now());
let playTimer = null;
let clockTimer = null;
let offs = [];

function durationText(record) {
  if (record.status === 'active') {
    const start = new Date(String(record.start_time).replace(' ', 'T')).getTime();
    return fmtDur(Math.max(0, Math.round((now.value - start) / 1000)));
  }
  return fmtDur(record.duration);
}

const columns = [
  { title: '通话编号', dataIndex: 'call_no', key: 'call_no', width: 108 },
  { title: '席位', dataIndex: 'position_code', key: 'position_code', width: 84 },
  { title: '信道 / 频率', key: 'channel', width: 158 },
  { title: '呼号', dataIndex: 'callsign', key: 'callsign', width: 86 },
  { title: '管制员', dataIndex: 'operator', key: 'operator', width: 86 },
  { title: '方向', dataIndex: 'direction', key: 'direction', width: 70 },
  { title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 152 },
  { title: '时长', dataIndex: 'duration', key: 'duration', width: 76 },
  { title: 'PTT', dataIndex: 'ptt_count', key: 'ptt_count', width: 62 },
  { title: '质量', dataIndex: 'quality', key: 'quality', width: 74 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 94 },
  { title: '操作', key: 'action', width: 108, fixed: 'right' },
];

const waveform = computed(() => {
  const seed = detail.value?.id || 1;
  return Array.from({ length: 48 }, (_, i) => {
    const v = Math.abs(Math.sin((i + seed) * 1.7) * Math.cos((i + seed) * 0.37));
    return 12 + Math.round(v * 82);
  });
});

async function load() {
  loading.value = true;
  try {
    const res = await api.calls.list({
      page: page.value,
      size: size.value,
      keyword: filters.keyword,
      status: filters.status,
      position_code: filters.position_code,
      channel_code: filters.channel_code,
      date_from: filters.range?.[0] || '',
      date_to: filters.range?.[1] || '',
    });
    list.value = res.data.list;
    total.value = res.data.total;
  } catch (e) {
    message.error(e.message);
  } finally {
    loading.value = false;
  }
}

function search() {
  page.value = 1;
  load();
}

function reset() {
  Object.assign(filters, { keyword: '', status: '', position_code: '', channel_code: '', range: [] });
  search();
}

async function openDetail(row) {
  drawer.open = true;
  drawer.loading = true;
  detail.value = null;
  playing.value = false;
  progress.value = 0;
  try {
    const res = await api.calls.detail(row.id);
    detail.value = res.data;
  } catch (e) {
    message.error(e.message);
  } finally {
    drawer.loading = false;
  }
}

function togglePlay() {
  if (!detail.value) return;
  if (playing.value) {
    playing.value = false;
    clearInterval(playTimer);
    return;
  }
  playing.value = true;
  const duration = Math.max(4, detail.value.duration || 10);
  playTimer = setInterval(() => {
    progress.value += 100 / (duration * 4);
    if (progress.value >= 100) {
      progress.value = 100;
      playing.value = false;
      clearInterval(playTimer);
    }
  }, 250);
}

function remove(row) {
  Modal.confirm({
    title: `删除通话记录 ${row.call_no}？`,
    content: '删除后该条通话记录及关联索引将不可恢复。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await api.calls.remove(row.id);
        message.success('记录已删除');
        load();
      } catch (e) {
        message.error(e.message);
      }
    },
  });
}

async function exportCsv() {
  try {
    const blob = await api.calls.exportCsv();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atc-calls-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('通话记录已导出');
  } catch (e) {
    message.error(e.message);
  }
}

onMounted(async () => {
  const [p, c] = await Promise.all([api.positions.list(), api.channels.list()]);
  positions.value = p.data;
  channels.value = c.data;
  load();
  clockTimer = setInterval(() => (now.value = Date.now()), 1000);
  offs.push(
    onRealtime('call', (payload) => {
      if (payload?.action === 'end') load();
    })
  );
});

onBeforeUnmount(() => {
  clearInterval(playTimer);
  clearInterval(clockTimer);
  offs.forEach((fn) => fn());
});
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h2>通话记录</h2>
        <p>全量话音通话留痕，支持按席位、信道、时间检索并回放录音波形</p>
      </div>
      <div class="toolbar">
        <a-button @click="load"><template #icon><ReloadOutlined /></template>刷新</a-button>
        <a-button type="primary" @click="exportCsv"><template #icon><DownloadOutlined /></template>导出 CSV</a-button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-body" style="padding-bottom: 6px">
        <div class="filter-bar">
          <a-input v-model:value="filters.keyword" placeholder="通话编号 / 呼号 / 管制员" style="width: 220px" allow-clear @press-enter="search">
            <template #prefix><SearchOutlined style="color: #a8b4c8" /></template>
          </a-input>
          <a-select v-model:value="filters.status" placeholder="全部状态" style="width: 120px" allow-clear>
            <a-select-option v-for="(v, k) in CALL_STATUS" :key="k" :value="k">{{ v.label }}</a-select-option>
          </a-select>
          <a-select v-model:value="filters.position_code" placeholder="全部席位" style="width: 140px" allow-clear show-search>
            <a-select-option v-for="p in positions" :key="p.code" :value="p.code">{{ p.code }}</a-select-option>
          </a-select>
          <a-select v-model:value="filters.channel_code" placeholder="全部信道" style="width: 160px" allow-clear show-search>
            <a-select-option v-for="c in channels" :key="c.code" :value="c.code">{{ c.code }}</a-select-option>
          </a-select>
          <a-range-picker v-model:value="filters.range" value-format="YYYY-MM-DD" style="width: 232px" />
          <a-button type="primary" @click="search">查询</a-button>
          <a-button @click="reset">重置</a-button>
        </div>

        <a-table
          :columns="columns"
          :data-source="list"
          :loading="loading"
          row-key="id"
          size="middle"
          :scroll="{ x: 1200 }"
          :pagination="{
            current: page,
            pageSize: size,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (t) => `共 ${t} 条通话`,
          }"
          @change="(p) => { page = p.current; size = p.pageSize; load(); }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'call_no'">
              <span class="mono" style="font-weight: 600">{{ record.call_no }}</span>
            </template>
            <template v-else-if="column.key === 'position_code'">
              <span class="mono">{{ record.position_code }}</span>
            </template>
            <template v-else-if="column.key === 'channel'">
              <span class="mono">{{ record.channel_code }}</span>
              <span style="color: var(--atc-text-3); font-size: 11px"> · {{ record.freq?.toFixed(3) }}</span>
            </template>
            <template v-else-if="column.key === 'callsign'">
              <span class="mono">{{ record.callsign || '—' }}</span>
            </template>
            <template v-else-if="column.key === 'direction'">
              {{ DIRECTION[record.direction]?.icon }} {{ DIRECTION[record.direction]?.label }}
            </template>
            <template v-else-if="column.key === 'start_time'">
              <span class="mono" style="font-size: 12px">{{ record.start_time }}</span>
            </template>
            <template v-else-if="column.key === 'duration'">
              <span class="num" :style="{ color: record.status === 'active' ? '#e8453c' : undefined }">{{ durationText(record) }}</span>
            </template>
            <template v-else-if="column.key === 'quality'">
              <span class="num" :style="{ color: qualityColor(record.quality), fontWeight: 600 }">{{ record.quality }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <StatusBadge :label="CALL_STATUS[record.status]?.label" :tone="CALL_STATUS[record.status]?.cls" />
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
              <a-button type="link" size="small" danger :disabled="record.status === 'active'" @click="remove(record)">删除</a-button>
            </template>
          </template>
        </a-table>
      </div>
    </div>

    <a-drawer v-model:open="drawer.open" title="通话详情与录音回放" width="480">
      <a-spin :spinning="drawer.loading">
        <div v-if="detail">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px">
            <div>
              <div class="mono" style="font-size: 17px; font-weight: 700">{{ detail.call_no }}</div>
              <div style="font-size: 11.5px; color: var(--atc-text-3); margin-top: 3px">{{ detail.start_time }} → {{ timeOnly(detail.end_time) }}</div>
            </div>
            <StatusBadge :label="CALL_STATUS[detail.status]?.label" :tone="CALL_STATUS[detail.status]?.cls" />
          </div>

          <div style="background: #f8fbff; border: 1px solid #eaf1fb; border-radius: 10px; padding: 14px; margin-bottom: 16px">
            <div style="display: flex; align-items: center; gap: 12px">
              <a-button type="primary" shape="circle" size="large" @click="togglePlay">
                <template #icon>
                  <PauseCircleFilled v-if="playing" />
                  <PlayCircleFilled v-else />
                </template>
              </a-button>
              <div style="flex: 1">
                <div class="wave" style="height: 44px">
                  <span
                    v-for="(h, i) in waveform"
                    :key="i"
                    :style="{
                      height: h + '%',
                      background: (i / waveform.length) * 100 <= progress ? 'linear-gradient(180deg,#1d5cf6,#4a80ff)' : '#dbe6f7',
                    }"
                  />
                </div>
                <a-progress :percent="Math.round(progress)" :show-info="false" size="small" style="margin-top: 6px" />
              </div>
              <span class="mono" style="font-size: 12px; color: var(--atc-text-2)">{{ fmtDur(detail.duration) }}</span>
            </div>
            <div style="font-size: 10.5px; color: var(--atc-text-3); margin-top: 8px">
              录音文件：REC_{{ detail.call_no }}_{{ detail.channel_code?.replace('.', '_') }}.wav · 8kHz/16bit
            </div>
          </div>

          <div class="detail-row"><span class="k">席位</span><span class="v mono">{{ detail.position_code }} · {{ detail.position?.name }}</span></div>
          <div class="detail-row"><span class="k">信道</span><span class="v mono">{{ detail.channel_code }}（{{ detail.freq?.toFixed(3) }} MHz）</span></div>
          <div class="detail-row"><span class="k">信道类型</span><span class="v">{{ detail.channel?.type === 'emergency' ? '应急频率' : detail.channel?.type === 'standby' ? '备用频率' : '主用频率' }}</span></div>
          <div class="detail-row"><span class="k">呼号</span><span class="v mono">{{ detail.callsign || '—' }}</span></div>
          <div class="detail-row"><span class="k">管制员</span><span class="v">{{ detail.operator || '—' }}</span></div>
          <div class="detail-row"><span class="k">通话方向</span><span class="v">{{ DIRECTION[detail.direction]?.label }}</span></div>
          <div class="detail-row"><span class="k">通话时长</span><span class="v mono">{{ fmtDur(detail.duration) }}</span></div>
          <div class="detail-row"><span class="k">PTT 次数</span><span class="v num">{{ detail.ptt_count }}</span></div>
          <div class="detail-row">
            <span class="k">语音质量</span>
            <span class="v num" :style="{ color: qualityColor(detail.quality) }">{{ detail.quality }} 分</span>
          </div>
          <div class="detail-row"><span class="k">链路备注</span><span class="v">{{ detail.remark || '链路正常' }}</span></div>

          <a-button block style="margin-top: 18px" type="primary" ghost>
            <template #icon><DownloadOutlined /></template>
            下载录音文件
          </a-button>
        </div>
      </a-spin>
    </a-drawer>
  </div>
</template>
