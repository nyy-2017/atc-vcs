<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { AudioOutlined, PhoneOutlined, PhoneFilled, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons-vue';
import { api } from '../api';
import { onRealtime } from '../api/realtime';
import { CHANNEL_STATUS, CHANNEL_TYPE, DIRECTION, POSITION_STATUS, fmtClock, qualityColor, timeOnly } from '../utils/dict';
import StatusBadge from '../components/StatusBadge.vue';

const positions = ref([]);
const channels = ref([]);
const selectedPosId = ref(null);
const selectedChannelId = ref(null);
const activeCall = ref(null);
const callsign = ref('');
const direction = ref('tx');
const startedAt = ref(0);
const elapsedSec = ref(0);
const pressing = ref(false);
const wave = ref(Array.from({ length: 26 }, () => 12));
const events = ref([]);
const busy = reactive({ start: false, end: false });

let tickTimer = null;
let waveTimer = null;
let offs = [];

const selectedPos = computed(() => positions.value.find((p) => p.id === selectedPosId.value) || null);
const selectedChannel = computed(() => channels.value.find((c) => c.id === selectedChannelId.value) || null);
const canStart = computed(
  () =>
    selectedPos.value &&
    selectedChannel.value &&
    !activeCall.value &&
    selectedChannel.value.status === 'idle' &&
    selectedPos.value.op_status !== 'busy'
);

const hint = computed(() => {
  if (activeCall.value) return `通话进行中 · ${activeCall.value.channel_code}`;
  if (!selectedChannel.value) return '请选择信道';
  if (!selectedPos.value) return '请选择席位';
  if (selectedChannel.value.status === 'disabled') return '该信道已停用';
  if (selectedChannel.value.status === 'fault') return '该信道故障，无法建立链路';
  if (selectedChannel.value.status === 'busy') return '信道被占用，请切换备用频率';
  if (selectedPos.value.op_status === 'busy') return '该席位存在进行中的通话';
  return '链路就绪，可建立通话';
});

function pushEvent(text, tone = 'blue') {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  events.value.unshift({ id: Date.now() + Math.random(), time: `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`, text, tone });
  if (events.value.length > 60) events.value.pop();
}

async function loadBase() {
  const [pos, ch] = await Promise.all([api.positions.list(), api.channels.list()]);
  positions.value = pos.data;
  channels.value = ch.data;
  if (!selectedPosId.value && positions.value.length) {
    const p = positions.value.find((x) => x.op_status !== 'offline') || positions.value[0];
    selectedPosId.value = p.id;
    selectDefaultChannel(p);
  }
  if (!selectedChannelId.value && channels.value.length) {
    selectedChannelId.value = channels.value[0].id;
  }
}

function selectDefaultChannel(pos) {
  if (pos?.default_channel_id) selectedChannelId.value = pos.default_channel_id;
}

async function loadActive() {
  const res = await api.calls.active();
  const ch = selectedChannel.value;
  const pos = selectedPos.value;
  const call =
    res.data.find((c) => ch && c.channel_id === ch.id && c.status === 'active') ||
    res.data.find((c) => pos && c.position_id === pos.id && c.status === 'active') ||
    null;
  activeCall.value = call;
  startedAt.value = call ? new Date(String(call.start_time).replace(' ', 'T')).getTime() : 0;
  if (call) {
    if (call.channel_id !== selectedChannelId.value) selectedChannelId.value = call.channel_id;
    callsign.value = call.callsign || '';
    direction.value = call.direction || 'tx';
  } else {
    elapsedSec.value = 0;
  }
}

function selectPosition(p) {
  selectedPosId.value = p.id;
  selectDefaultChannel(p);
  loadActive();
}

async function startCall() {
  if (!selectedPos.value || !selectedChannel.value) return;
  busy.start = true;
  try {
    const res = await api.calls.start({
      positionId: selectedPosId.value,
      channelId: selectedChannelId.value,
      direction: direction.value,
      callsign: callsign.value.trim(),
    });
    activeCall.value = res.data;
    startedAt.value = Date.now();
    elapsedSec.value = 0;
    message.success(`通话已建立 · ${selectedChannel.value.code}`);
    pushEvent(`${selectedPos.value.code} 通过 ${selectedChannel.value.code} 建立通话${callsign.value ? '（' + callsign.value + '）' : ''}`, 'blue');
    refreshChannels();
  } catch (e) {
    message.error(e.message);
  } finally {
    busy.start = false;
  }
}

async function endCall() {
  if (!activeCall.value) return;
  busy.end = true;
  try {
    const res = await api.calls.end(activeCall.value.id);
    pushEvent(`通话结束 · 时长 ${res.data.duration}s · 质量 ${res.data.quality} 分`, 'teal');
    message.success('通话已结束');
    activeCall.value = null;
    startedAt.value = 0;
    elapsedSec.value = 0;
    refreshChannels();
  } catch (e) {
    message.error(e.message);
  } finally {
    busy.end = false;
  }
}

let lastPtt = 0;
async function sendPtt() {
  if (!activeCall.value) return;
  const now = Date.now();
  if (now - lastPtt < 700) return;
  lastPtt = now;
  try {
    const res = await api.calls.ptt(activeCall.value.id);
    activeCall.value = res.data;
  } catch {
    /* 忽略连点异常 */
  }
}

function onPttDown() {
  if (!activeCall.value) {
    message.warning('请先建立通话再使用 PTT 发话');
    return;
  }
  pressing.value = true;
  sendPtt();
}

function onPttUp() {
  pressing.value = false;
}

async function refreshChannels() {
  const [ch, pos] = await Promise.all([api.channels.list(), api.positions.list()]);
  channels.value = ch.data;
  positions.value = pos.data;
}

function onKeyDown(e) {
  if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && !e.repeat) {
    e.preventDefault();
    onPttDown();
  }
}
function onKeyUp(e) {
  if (e.code === 'Space') onPttUp();
}

onMounted(async () => {
  await loadBase();
  await loadActive();
  pushEvent(`通信指挥台已就绪 · ${selectedPos.value?.code || '—'} 值守，监听 ${selectedChannel.value?.code || '—'}`, 'teal');
  tickTimer = setInterval(() => {
    if (activeCall.value) elapsedSec.value = Math.max(0, Math.round((Date.now() - startedAt.value) / 1000));
  }, 1000);
  waveTimer = setInterval(() => {
    const amp = activeCall.value ? (pressing.value ? 1 : 0.55) : 0.22;
    wave.value = wave.value.map(() => Math.max(12, Math.round(Math.random() * 100 * amp)));
  }, 160);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  offs.push(
    onRealtime('call', async (payload) => {
      await refreshChannels();
      await loadActive();
      if (payload?.action === 'end') {
        if (activeCall.value && payload.data?.id === activeCall.value.id) {
          activeCall.value = null;
          startedAt.value = 0;
          elapsedSec.value = 0;
        }
      }
      if (payload?.action === 'start' && payload.data) {
        pushEvent(`${payload.data.position_code} 占用 ${payload.data.channel_code}${payload.data.callsign ? '（' + payload.data.callsign + '）' : ''}`, 'amber');
      }
    })
  );
});

onBeforeUnmount(() => {
  clearInterval(tickTimer);
  clearInterval(waveTimer);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  offs.forEach((fn) => fn());
});

const quickGroups = computed(() => [
  { key: 'primary', label: '主用频率', list: channels.value.filter((c) => c.type === 'primary') },
  { key: 'standby', label: '备用频率', list: channels.value.filter((c) => c.type === 'standby') },
  { key: 'emergency', label: '应急频率', list: channels.value.filter((c) => c.type === 'emergency') },
]);
</script>

<template>
  <div class="console-grid">
    <div class="panel">
      <div class="panel-head"><div class="t">管制席位</div><span class="soft-badge gray">{{ positions.length }}</span></div>
      <div class="panel-body" style="padding: 10px 12px; max-height: calc(100vh - 210px); overflow-y: auto">
        <div
          v-for="p in positions"
          :key="p.id"
          class="pos-item"
          :class="{ active: p.id === selectedPosId }"
          @click="selectPosition(p)"
        >
          <div style="display: flex; align-items: center; justify-content: space-between">
            <span class="pos-code mono">{{ p.code }}</span>
            <StatusBadge
              :label="POSITION_STATUS[p.op_status]?.label"
              :tone="POSITION_STATUS[p.op_status]?.cls"
              dot
              :dot-color="POSITION_STATUS[p.op_status]?.dot"
            />
          </div>
          <div class="pos-name">{{ p.name }}</div>
          <div style="font-size: 11px; color: var(--atc-text-3); margin-top: 4px; display: flex; justify-content: space-between">
            <span>{{ p.operator || '未指派' }}</span>
            <span>今日 {{ p.calls_today }} 通</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid" style="gap: 14px; align-content: start">
    <div class="panel">
      <div class="panel-head">
        <div class="t">话音交换 · 当前链路</div>
        <a-button size="small" type="text" @click="refreshChannels"><ReloadOutlined /> 刷新</a-button>
      </div>

      <div class="panel-body">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px">
          <a-select v-model:value="selectedPosId" placeholder="选择席位" @change="(v) => selectPosition(positions.find((p) => p.id === v))">
            <a-select-option v-for="p in positions" :key="p.id" :value="p.id">
              {{ p.code }} · {{ p.name }}
            </a-select-option>
          </a-select>
          <a-select v-model:value="selectedChannelId" placeholder="选择信道">
            <a-select-option v-for="c in channels" :key="c.id" :value="c.id" :disabled="c.status === 'disabled'">
              {{ c.code }} · {{ c.freq.toFixed(3) }} MHz
              <span v-if="c.status === 'busy'">（占用）</span>
              <span v-else-if="c.status === 'fault'">（故障）</span>
            </a-select-option>
          </a-select>
        </div>

        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px">
          <div style="flex: 1; min-width: 0">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px">
              <StatusBadge
                :label="CHANNEL_STATUS[selectedChannel?.status]?.label || '未选择'"
                :tone="CHANNEL_STATUS[selectedChannel?.status]?.cls || 'gray'"
                dot
                :dot-color="CHANNEL_STATUS[selectedChannel?.status]?.dot || '#8d9bb2'"
              />
              <StatusBadge :label="CHANNEL_TYPE[selectedChannel?.type]?.label || '—'" :tone="CHANNEL_TYPE[selectedChannel?.type]?.cls || 'gray'" />
              <span style="font-size: 11.5px; color: var(--atc-text-3)">{{ selectedChannel?.coverage || '—' }}</span>
            </div>
            <div class="ch-freq">
              {{ selectedChannel?.freq?.toFixed(3) || '---.---' }}<small>MHz</small>
            </div>
            <div style="margin-top: 6px; color: var(--atc-text-2); font-size: 12.5px">
              {{ selectedChannel?.name || '请选择信道' }}
              <span style="color: var(--atc-text-3)"> · {{ selectedChannel?.code || '—' }} · {{ selectedChannel?.band || '' }}</span>
            </div>
          </div>

          <div style="text-align: center">
            <div style="font-size: 11px; color: var(--atc-text-3); letter-spacing: 1px; margin-bottom: 4px">TALK TIME</div>
            <div class="timer">{{ fmtClock(elapsedSec) }}</div>
            <div style="font-size: 11px; color: var(--atc-text-3); margin-top: 2px">
              {{ activeCall ? `PTT ${activeCall.ptt_count} 次` : '未通话' }}
            </div>
          </div>
        </div>

        <div style="margin: 18px 0 10px; background: #f8fbff; border: 1px solid #eaf1fb; border-radius: 10px; padding: 10px 14px">
          <div class="wave" style="height: 46px">
            <span v-for="(h, i) in wave" :key="i" :style="{ height: h + '%', opacity: activeCall ? 0.95 : 0.35 }" />
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: var(--atc-text-3); margin-top: 6px">
            <span>RX LEVEL {{ activeCall ? activeCall.audio_level : 0 }} dB</span>
            <span>{{ pressing ? 'PTT 正在发话…' : activeCall ? '链路已建立，可按键发话' : '链路空闲' }}</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; align-items: end; margin-bottom: 16px">
          <div>
            <div style="font-size: 11px; color: var(--atc-text-3); margin-bottom: 5px">航班呼号</div>
            <a-input v-model:value="callsign" placeholder="如 CCA1501" :disabled="Boolean(activeCall)" />
          </div>
          <div>
            <div style="font-size: 11px; color: var(--atc-text-3); margin-bottom: 5px">通话方向</div>
            <a-radio-group v-model:value="direction" :disabled="Boolean(activeCall)" size="small" button-style="solid">
              <a-radio-button value="tx">发话</a-radio-button>
              <a-radio-button value="rx">收听</a-radio-button>
              <a-radio-button value="duplex">双向</a-radio-button>
            </a-radio-group>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--atc-text-3); margin-bottom: 5px">语音质量</div>
            <div style="height: 32px; display: flex; align-items: center; gap: 8px">
              <a-progress
                :percent="activeCall?.quality || 0"
                :stroke-color="qualityColor(activeCall?.quality || 0)"
                :show-info="false"
                size="small"
                style="flex: 1"
              />
              <span class="num" style="font-size: 12px">{{ activeCall?.quality || 0 }}</span>
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: center; gap: 26px; padding: 6px 0 2px">
          <div style="text-align: center">
            <button
              class="ptt-pad"
              :class="{ pressing }"
              :disabled="!activeCall"
              @mousedown="onPttDown"
              @mouseup="onPttUp"
              @mouseleave="onPttUp"
            >
              <PhoneFilled v-if="pressing" style="font-size: 22px" />
              <AudioOutlined v-else style="font-size: 22px" />
              PTT
              <small>按住发话 / 空格键</small>
            </button>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px; min-width: 180px">
            <a-button
              type="primary"
              size="large"
              :disabled="!canStart"
              :loading="busy.start"
              block
              @click="startCall"
            >
              <template #icon><PhoneOutlined /></template>
              建立通话
            </a-button>
            <a-button danger size="large" :disabled="!activeCall" :loading="busy.end" block @click="endCall">
              结束通话
            </a-button>
            <div style="font-size: 11px; color: var(--atc-text-3); text-align: center">
              {{ hint }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div class="t">信道占用矩阵</div>
        <div style="display: flex; align-items: center; gap: 12px; font-size: 11px; color: var(--atc-text-3)">
          <span><i class="dot" style="background: #0fae9a" /> 空闲</span>
          <span><i class="dot" style="background: #e8453c" /> 占用</span>
          <span><i class="dot" style="background: #f0a020" /> 故障</span>
          <span><i class="dot" style="background: #c3cddd" /> 停用</span>
        </div>
      </div>
      <div class="panel-body" style="padding: 12px">
        <div class="ch-matrix">
          <div
            v-for="c in channels"
            :key="c.id"
            class="ch-cell"
            :class="[`ch-${c.status}`, { active: c.id === selectedChannelId }]"
            @click="selectedChannelId = c.id"
          >
            <div style="display: flex; align-items: center; justify-content: space-between">
              <span class="mono" style="font-size: 11px; color: var(--atc-text-3)">{{ c.code }}</span>
              <span class="dot" :style="{ background: CHANNEL_STATUS[c.status]?.dot }" />
            </div>
            <div class="mono" style="font-size: 14px; font-weight: 700; letter-spacing: -0.3px; margin-top: 3px">
              {{ c.freq.toFixed(3) }}
            </div>
            <div style="font-size: 10px; color: var(--atc-text-3); margin-top: 2px">
              {{ CHANNEL_STATUS[c.status]?.label }} · 今日 {{ c.calls_today }} 通
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>

    <div class="grid" style="gap: 14px; align-content: start">
      <div class="panel">
        <div class="panel-head"><div class="t">快捷频率切换</div></div>
        <div class="panel-body" style="padding: 10px 12px; max-height: 320px; overflow-y: auto">
          <div v-for="g in quickGroups" :key="g.key" style="margin-bottom: 12px">
            <div style="font-size: 11px; color: var(--atc-text-3); margin-bottom: 6px; letter-spacing: 0.4px">{{ g.label }}</div>
            <div
              v-for="c in g.list"
              :key="c.id"
              class="pos-item"
              :class="{ active: c.id === selectedChannelId }"
              style="padding: 8px 10px"
              @click="selectedChannelId = c.id"
            >
              <div style="display: flex; align-items: center; justify-content: space-between">
                <span class="mono" style="font-size: 12px; font-weight: 600">{{ c.freq.toFixed(3) }}</span>
                <span class="dot" :style="{ background: CHANNEL_STATUS[c.status]?.dot }" />
              </div>
              <div style="font-size: 10.5px; color: var(--atc-text-3); margin-top: 2px">{{ c.code }} · {{ CHANNEL_STATUS[c.status]?.label }}</div>
            </div>
            <div v-if="!g.list.length" style="font-size: 11px; color: var(--atc-text-3)">暂无配置</div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <div class="t">实时事件流</div>
          <ThunderboltOutlined style="color: #0fae9a" />
        </div>
        <div class="panel-body" style="padding: 6px 14px 10px; max-height: calc(100vh - 500px); min-height: 180px; overflow-y: auto">
          <div v-if="!events.length" class="empty-hint">等待通信事件…</div>
          <div v-for="e in events" :key="e.id" class="event-line">
            <span class="event-time mono">{{ e.time }}</span>
            <span class="dot" :style="{ background: e.tone === 'teal' ? '#0fae9a' : e.tone === 'amber' ? '#f0a020' : '#1d5cf6', marginTop: '5px' }" />
            <span style="flex: 1; color: var(--atc-text-2)">{{ e.text }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
