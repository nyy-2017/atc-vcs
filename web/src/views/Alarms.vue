<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { AlertOutlined, CheckOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import { api } from '../api';
import { onRealtime } from '../api/realtime';
import { ALARM_LEVEL, ALARM_STATUS } from '../utils/dict';
import StatusBadge from '../components/StatusBadge.vue';

const list = ref([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const summary = ref({ critical: 0, major: 0, minor: 0, info: 0 });
const filters = reactive({ level: undefined, status: 'active', keyword: '' });
const modal = reactive({ open: false, saving: false });
const form = reactive({ level: 'minor', source: '人工上报', code: 'MANUAL', message: '', target: '' });
let offs = [];

const columns = [
  { title: '级别', dataIndex: 'level', key: 'level', width: 88 },
  { title: '告警内容', dataIndex: 'message', key: 'message' },
  { title: '来源', dataIndex: 'source', key: 'source', width: 110 },
  { title: '对象', dataIndex: 'target', key: 'target', width: 118 },
  { title: '发生时间', dataIndex: 'created_at', key: 'created_at', width: 156 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 96 },
  { title: '处理人', dataIndex: 'acked_by', key: 'acked_by', width: 96 },
  { title: '操作', key: 'action', width: 186, fixed: 'right' },
];

const cards = computed(() => [
  { label: '紧急告警', value: summary.value.critical, color: '#e8453c', bg: '#fdeceb' },
  { label: '重要告警', value: summary.value.major, color: '#e08c00', bg: '#fff5e3' },
  { label: '次要告警', value: summary.value.minor, color: '#1d5cf6', bg: '#eaf1ff' },
  { label: '提示信息', value: summary.value.info, color: '#5c6b85', bg: '#f0f3f8' },
]);

async function load() {
  loading.value = true;
  try {
    const res = await api.alarms.list({
      page: page.value,
      size: size.value,
      level: filters.level,
      status: filters.status,
      keyword: filters.keyword,
    });
    list.value = res.data.list;
    total.value = res.data.total;
    summary.value = res.data.summary;
  } catch (e) {
    message.error(e.message);
  } finally {
    loading.value = false;
  }
}

async function ack(row) {
  try {
    await api.alarms.ack(row.id);
    message.success('告警已确认');
    load();
  } catch (e) {
    message.error(e.message);
  }
}

async function clear(row) {
  try {
    await api.alarms.clear(row.id);
    message.success('告警已清除');
    load();
  } catch (e) {
    message.error(e.message);
  }
}

function remove(row) {
  Modal.confirm({
    title: '删除该条告警记录？',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await api.alarms.remove(row.id);
        message.success('已删除');
        load();
      } catch (e) {
        message.error(e.message);
      }
    },
  });
}

async function submit() {
  if (!form.message.trim()) {
    message.warning('请填写告警内容');
    return;
  }
  modal.saving = true;
  try {
    await api.alarms.create({ ...form });
    modal.open = false;
    form.message = '';
    message.success('告警已上报');
    load();
  } catch (e) {
    message.error(e.message);
  } finally {
    modal.saving = false;
  }
}

onMounted(() => {
  load();
  offs.push(onRealtime('alarm', () => load()));
});
onBeforeUnmount(() => offs.forEach((fn) => fn()));
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h2>告警中心</h2>
        <p>汇聚信道、链路、供电与录音服务告警，支持确认、清除与人工上报</p>
      </div>
      <div class="toolbar">
        <a-button @click="load"><template #icon><ReloadOutlined /></template>刷新</a-button>
        <a-button type="primary" @click="modal.open = true"><template #icon><PlusOutlined /></template>上报告警</a-button>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 14px">
      <div v-for="c in cards" :key="c.label" class="panel" style="padding: 13px 16px; display: flex; align-items: center; gap: 12px">
        <div
          style="width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center"
          :style="{ background: c.bg, color: c.color }"
        >
          <AlertOutlined />
        </div>
        <div>
          <div class="stat-label">{{ c.label }}</div>
          <div style="font-size: 22px; font-weight: 700; color: c.color">{{ c.value }}</div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-body" style="padding-bottom: 6px">
        <div class="filter-bar">
          <a-input v-model:value="filters.keyword" placeholder="搜索告警内容 / 来源" style="width: 240px" allow-clear @press-enter="page = 1; load()">
            <template #prefix><AlertOutlined style="color: #a8b4c8" /></template>
          </a-input>
          <a-select v-model:value="filters.level" placeholder="全部级别" style="width: 130px" allow-clear @change="page = 1; load()">
            <a-select-option v-for="(v, k) in ALARM_LEVEL" :key="k" :value="k">{{ v.label }}</a-select-option>
          </a-select>
          <a-select v-model:value="filters.status" placeholder="全部状态" style="width: 130px" allow-clear @change="page = 1; load()">
            <a-select-option v-for="(v, k) in ALARM_STATUS" :key="k" :value="k">{{ v.label }}</a-select-option>
          </a-select>
          <a-button type="primary" ghost @click="page = 1; load()">查询</a-button>
          <span style="margin-left: auto; white-space: nowrap; flex: 0 0 auto; color: var(--atc-text-3); font-size: 12px">
            未清除 {{ summary.critical + summary.major + summary.minor + summary.info }} 条
          </span>
        </div>

        <a-table
          :columns="columns"
          :data-source="list"
          :loading="loading"
          row-key="id"
          size="middle"
          :scroll="{ x: 1050 }"
          :pagination="{
            current: page,
            pageSize: size,
            total,
            showSizeChanger: false,
            showTotal: (t) => `共 ${t} 条`,
          }"
          @change="(p) => { page = p.current; load(); }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'level'">
              <StatusBadge :label="ALARM_LEVEL[record.level]?.label" :tone="ALARM_LEVEL[record.level]?.cls" />
            </template>
            <template v-else-if="column.key === 'message'">
              <div style="line-height: 1.55">
                {{ record.message }}
                <span class="mono" style="font-size: 10.5px; color: var(--atc-text-3); margin-left: 8px">{{ record.code }}</span>
              </div>
            </template>
            <template v-else-if="column.key === 'target'">
              <span class="mono">{{ record.target || '—' }}</span>
            </template>
            <template v-else-if="column.key === 'created_at'">
              <span class="mono" style="font-size: 12px">{{ record.created_at }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <StatusBadge :label="ALARM_STATUS[record.status]?.label" :tone="ALARM_STATUS[record.status]?.cls" />
            </template>
            <template v-else-if="column.key === 'acked_by'">
              {{ record.acked_by || '—' }}
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button type="link" size="small" :disabled="record.status !== 'active'" @click="ack(record)">
                <CheckOutlined /> 确认
              </a-button>
              <a-button type="link" size="small" :disabled="record.status === 'cleared'" @click="clear(record)">清除</a-button>
              <a-button type="link" size="small" danger @click="remove(record)">删除</a-button>
            </template>
          </template>
        </a-table>
      </div>
    </div>

    <a-modal v-model:open="modal.open" title="人工上报告警" :confirm-loading="modal.saving" ok-text="提交" cancel-text="取消" @ok="submit">
      <a-form layout="vertical" style="margin-top: 8px">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px">
          <a-form-item label="告警级别">
            <a-select v-model:value="form.level">
              <a-select-option v-for="(v, k) in ALARM_LEVEL" :key="k" :value="k">{{ v.label }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="来源">
            <a-input v-model:value="form.source" />
          </a-form-item>
        </div>
        <a-form-item label="告警内容" required>
          <a-textarea v-model:value="form.message" :rows="3" placeholder="描述故障现象与影响范围" />
        </a-form-item>
        <a-form-item label="关联对象">
          <a-input v-model:value="form.target" placeholder="如 VHF-118.100 / UPS-A" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
