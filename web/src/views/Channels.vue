<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { api } from '../api';
import { BANDS, CHANNEL_STATUS, CHANNEL_TYPE } from '../utils/dict';
import StatusBadge from '../components/StatusBadge.vue';

const list = ref([]);
const positions = ref([]);
const loading = ref(false);
const filters = reactive({ keyword: '', status: undefined, type: undefined });
const modal = reactive({ open: false, mode: 'create', saving: false, id: null });
const form = reactive({
  code: '',
  name: '',
  freq: 118.1,
  band: 'VHF',
  type: 'primary',
  status: 'idle',
  tx_power: 25,
  position_id: null,
  coverage: '',
  squelch: 60,
  remark: '',
});

const summary = computed(() => {
  const s = { total: list.value.length, idle: 0, busy: 0, fault: 0 };
  list.value.forEach((c) => {
    if (c.status === 'idle') s.idle++;
    else if (c.status === 'busy') s.busy++;
    else if (c.status === 'fault') s.fault++;
  });
  return s;
});

const columns = [
  { title: '信道编号', dataIndex: 'code', key: 'code', width: 130 },
  { title: '频率 (MHz)', dataIndex: 'freq', key: 'freq', width: 118, sorter: (a, b) => a.freq - b.freq },
  { title: '信道名称', dataIndex: 'name', key: 'name' },
  { title: '频段/类型', key: 'type', width: 130 },
  { title: '发射功率', dataIndex: 'tx_power', key: 'tx_power', width: 96 },
  { title: '覆盖范围', dataIndex: 'coverage', key: 'coverage', width: 150 },
  { title: '今日通话', dataIndex: 'calls_today', key: 'calls_today', width: 92 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 168, fixed: 'right' },
];

async function load() {
  loading.value = true;
  try {
    const res = await api.channels.list({ ...filters });
    list.value = res.data;
  } catch (e) {
    message.error(e.message);
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  Object.assign(form, {
    code: '',
    name: '',
    freq: 118.1,
    band: 'VHF',
    type: 'primary',
    status: 'idle',
    tx_power: 25,
    position_id: null,
    coverage: '',
    squelch: 60,
    remark: '',
  });
  modal.mode = 'create';
  modal.open = true;
}

function openEdit(row) {
  Object.assign(form, row);
  modal.id = row.id;
  modal.mode = 'edit';
  modal.open = true;
}

async function save() {
  if (!form.code || !form.name || !form.freq) {
    message.warning('请完整填写信道编号、名称与频率');
    return;
  }
  modal.saving = true;
  try {
    if (modal.mode === 'create') {
      await api.channels.create({ ...form });
      message.success('信道已创建');
    } else {
      await api.channels.update(modal.id, { ...form });
      message.success('信道已更新');
    }
    modal.open = false;
    load();
  } catch (e) {
    message.error(e.message);
  } finally {
    modal.saving = false;
  }
}

async function toggleBusy(row) {
  const next = row.status === 'busy' ? 'idle' : 'busy';
  try {
    await api.channels.update(row.id, { status: next });
    message.success(next === 'busy' ? `${row.code} 已置为占用` : `${row.code} 已恢复空闲`);
    load();
  } catch (e) {
    message.error(e.message);
  }
}

function remove(row) {
  Modal.confirm({
    title: `删除信道 ${row.code}？`,
    content: '删除后该频率配置将从交换矩阵中移除，历史通话记录仍然保留。',
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await api.channels.remove(row.id);
        message.success('信道已删除');
        load();
      } catch (e) {
        message.error(e.message);
      }
    },
  });
}

onMounted(async () => {
  const p = await api.positions.list();
  positions.value = p.data;
  load();
});
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h2>信道频率管理</h2>
        <p>维护 VHF/UHF 话音信道、主备频率与发射参数，删除操作将同步至交换矩阵</p>
      </div>
      <div class="toolbar">
        <a-button @click="load"><template #icon><ReloadOutlined /></template>刷新</a-button>
        <a-button type="primary" @click="openCreate"><template #icon><PlusOutlined /></template>新增信道</a-button>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 14px">
      <div class="panel" style="padding: 12px 16px">
        <div class="stat-label">信道总数</div>
        <div style="font-size: 22px; font-weight: 700">{{ summary.total }}</div>
      </div>
      <div class="panel" style="padding: 12px 16px">
        <div class="stat-label">空闲</div>
        <div style="font-size: 22px; font-weight: 700; color: #0fae9a">{{ summary.idle }}</div>
      </div>
      <div class="panel" style="padding: 12px 16px">
        <div class="stat-label">占用中</div>
        <div style="font-size: 22px; font-weight: 700; color: #1d5cf6">{{ summary.busy }}</div>
      </div>
      <div class="panel" style="padding: 12px 16px">
        <div class="stat-label">故障</div>
        <div style="font-size: 22px; font-weight: 700" :style="{ color: summary.fault ? '#e8453c' : '#16233a' }">{{ summary.fault }}</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-body" style="padding-bottom: 6px">
        <div class="filter-bar">
          <a-input v-model:value="filters.keyword" placeholder="搜索信道编号 / 名称 / 频率" style="width: 250px" allow-clear @press-enter="load">
            <template #prefix><SearchOutlined style="color: #a8b4c8" /></template>
          </a-input>
          <a-select v-model:value="filters.status" placeholder="全部状态" style="width: 130px" allow-clear @change="load">
            <a-select-option v-for="(v, k) in CHANNEL_STATUS" :key="k" :value="k">{{ v.label }}</a-select-option>
          </a-select>
          <a-select v-model:value="filters.type" placeholder="全部类型" style="width: 130px" allow-clear @change="load">
            <a-select-option v-for="(v, k) in CHANNEL_TYPE" :key="k" :value="k">{{ v.label }}</a-select-option>
          </a-select>
          <a-button type="primary" ghost @click="load">查询</a-button>
          <span style="color: var(--atc-text-3); font-size: 12px">共 {{ list.length }} 条</span>
        </div>

        <a-table
          :columns="columns"
          :data-source="list"
          :loading="loading"
          row-key="id"
          size="middle"
          :scroll="{ x: 1080 }"
          :pagination="{ pageSize: 8, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'code'">
              <span class="mono" style="font-weight: 600">{{ record.code }}</span>
            </template>
            <template v-else-if="column.key === 'freq'">
              <span class="mono" style="font-weight: 700; font-size: 13px">{{ record.freq.toFixed(3) }}</span>
            </template>
            <template v-else-if="column.key === 'type'">
              <StatusBadge :label="record.band" tone="gray" />
              <StatusBadge :label="CHANNEL_TYPE[record.type]?.label" :tone="CHANNEL_TYPE[record.type]?.cls" style="margin-left: 4px" />
            </template>
            <template v-else-if="column.key === 'tx_power'">
              <span class="num">{{ record.tx_power }} W</span>
            </template>
            <template v-else-if="column.key === 'calls_today'">
              <span class="num">{{ record.calls_today }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <StatusBadge
                :label="CHANNEL_STATUS[record.status]?.label"
                :tone="CHANNEL_STATUS[record.status]?.cls"
                dot
                :dot-color="CHANNEL_STATUS[record.status]?.dot"
              />
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-button type="link" size="small" @click="toggleBusy(record)">
                {{ record.status === 'busy' ? '置闲' : '置忙' }}
              </a-button>
              <a-button type="link" size="small" danger @click="remove(record)">删除</a-button>
            </template>
          </template>
        </a-table>
      </div>
    </div>

    <a-modal
      v-model:open="modal.open"
      :title="modal.mode === 'create' ? '新增信道' : `编辑信道 · ${form.code}`"
      :confirm-loading="modal.saving"
      width="620px"
      ok-text="保存"
      cancel-text="取消"
      @ok="save"
    >
      <a-form layout="vertical" style="margin-top: 8px">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px">
          <a-form-item label="信道编号" required>
            <a-input v-model:value="form.code" placeholder="如 VHF-118.100" />
          </a-form-item>
          <a-form-item label="信道名称" required>
            <a-input v-model:value="form.name" placeholder="如 塔台主用频率" />
          </a-form-item>
          <a-form-item label="频率 (MHz)" required>
            <a-input-number v-model:value="form.freq" :min="100" :max="400" :step="0.005" :precision="3" style="width: 100%" />
          </a-form-item>
          <a-form-item label="频段">
            <a-select v-model:value="form.band">
              <a-select-option v-for="b in BANDS" :key="b" :value="b">{{ b }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="信道类型">
            <a-select v-model:value="form.type">
              <a-select-option v-for="(v, k) in CHANNEL_TYPE" :key="k" :value="k">{{ v.label }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="信道状态">
            <a-select v-model:value="form.status">
              <a-select-option v-for="(v, k) in CHANNEL_STATUS" :key="k" :value="k">{{ v.label }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="发射功率 (W)">
            <a-input-number v-model:value="form.tx_power" :min="1" :max="100" style="width: 100%" />
          </a-form-item>
          <a-form-item label="绑定席位">
            <a-select v-model:value="form.position_id" allow-clear placeholder="可不绑定">
              <a-select-option v-for="p in positions" :key="p.id" :value="p.id">{{ p.code }} · {{ p.name }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="覆盖范围">
            <a-input v-model:value="form.coverage" placeholder="如 本场及 25NM" />
          </a-form-item>
          <a-form-item label="静噪门限">
            <a-input-number v-model:value="form.squelch" :min="0" :max="100" style="width: 100%" />
          </a-form-item>
        </div>
        <a-form-item label="备注">
          <a-textarea v-model:value="form.remark" :rows="2" placeholder="可填写设备型号、天线朝向等信息" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
