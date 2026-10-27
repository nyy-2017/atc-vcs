<script setup>
import { onMounted, reactive, ref } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { api } from '../api';
import { POSITION_STATUS, POSITION_TYPE, SECTORS } from '../utils/dict';
import StatusBadge from '../components/StatusBadge.vue';

const list = ref([]);
const channels = ref([]);
const loading = ref(false);
const filters = reactive({ keyword: '', sector: undefined, op_status: undefined });
const modal = reactive({ open: false, mode: 'create', saving: false, id: null });

const blank = () => ({
  code: '',
  name: '',
  sector: '塔台',
  type: 'main',
  default_channel_id: null,
  headset: 'normal',
  op_status: 'offline',
  ip: '',
  operator: '',
  remark: '',
});
const form = reactive(blank());

const columns = [
  { title: '席位编号', dataIndex: 'code', key: 'code', width: 108 },
  { title: '席位名称', dataIndex: 'name', key: 'name' },
  { title: '所属扇区', dataIndex: 'sector', key: 'sector', width: 92 },
  { title: '席位类型', key: 'type', width: 100 },
  { title: '值守人员', dataIndex: 'operator', key: 'operator', width: 100 },
  { title: '默认信道', key: 'channel', width: 130 },
  { title: '耳机', key: 'headset', width: 82 },
  { title: '今日通话', dataIndex: 'calls_today', key: 'calls_today', width: 92 },
  { title: '运行状态', dataIndex: 'op_status', key: 'op_status', width: 130 },
  { title: '操作', key: 'action', width: 120, fixed: 'right' },
];

async function load() {
  loading.value = true;
  try {
    const res = await api.positions.list({ ...filters });
    list.value = res.data;
  } catch (e) {
    message.error(e.message);
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  Object.assign(form, blank());
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
  if (!form.code || !form.name || !form.sector) {
    message.warning('请完整填写席位编号、名称与所属扇区');
    return;
  }
  modal.saving = true;
  try {
    if (modal.mode === 'create') {
      await api.positions.create({ ...form });
      message.success('席位已创建');
    } else {
      await api.positions.update(modal.id, { ...form });
      message.success('席位已更新');
    }
    modal.open = false;
    load();
  } catch (e) {
    message.error(e.message);
  } finally {
    modal.saving = false;
  }
}

async function changeStatus(row, value) {
  try {
    await api.positions.update(row.id, { op_status: value });
    row.op_status = value;
    message.success(`${row.code} 已切换为${POSITION_STATUS[value]?.label}`);
  } catch (e) {
    message.error(e.message);
  }
}

function remove(row) {
  Modal.confirm({
    title: `删除席位 ${row.code}？`,
    content: '删除前请确认该席位没有进行中的通话。',
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await api.positions.remove(row.id);
        message.success('席位已删除');
        load();
      } catch (e) {
        message.error(e.message);
      }
    },
  });
}

function channelLabel(id) {
  const c = channels.value.find((x) => x.id === id);
  return c ? `${c.code}` : '—';
}

onMounted(async () => {
  const c = await api.channels.list();
  channels.value = c.data;
  load();
});
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h2>席位管理</h2>
        <p>维护塔台、进近、区域管制等管制席位，绑定默认信道并跟踪在位状态</p>
      </div>
      <div class="toolbar">
        <a-button @click="load"><template #icon><ReloadOutlined /></template>刷新</a-button>
        <a-button type="primary" @click="openCreate"><template #icon><PlusOutlined /></template>新增席位</a-button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-body" style="padding-bottom: 6px">
        <div class="filter-bar">
          <a-input v-model:value="filters.keyword" placeholder="搜索席位编号 / 名称 / 值守人" style="width: 260px" allow-clear @press-enter="load">
            <template #prefix><SearchOutlined style="color: #a8b4c8" /></template>
          </a-input>
          <a-select v-model:value="filters.sector" placeholder="全部扇区" style="width: 130px" allow-clear @change="load">
            <a-select-option v-for="s in SECTORS" :key="s" :value="s">{{ s }}</a-select-option>
          </a-select>
          <a-select v-model:value="filters.op_status" placeholder="全部状态" style="width: 130px" allow-clear @change="load">
            <a-select-option v-for="(v, k) in POSITION_STATUS" :key="k" :value="k">{{ v.label }}</a-select-option>
          </a-select>
          <a-button type="primary" ghost @click="load">查询</a-button>
          <span style="color: var(--atc-text-3); font-size: 12px">共 {{ list.length }} 个席位</span>
        </div>

        <a-table
          :columns="columns"
          :data-source="list"
          :loading="loading"
          row-key="id"
          size="middle"
          :scroll="{ x: 1120 }"
          :pagination="{ pageSize: 10, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'code'">
              <span class="mono" style="font-weight: 600">{{ record.code }}</span>
            </template>
            <template v-else-if="column.key === 'sector'">
              <StatusBadge :label="record.sector" tone="gray" />
            </template>
            <template v-else-if="column.key === 'type'">
              <StatusBadge :label="POSITION_TYPE[record.type]?.label" :tone="POSITION_TYPE[record.type]?.cls" />
            </template>
            <template v-else-if="column.key === 'channel'">
              <span class="mono">{{ channelLabel(record.default_channel_id) }}</span>
            </template>
            <template v-else-if="column.key === 'headset'">
              <StatusBadge :label="record.headset === 'normal' ? '正常' : '异常'" :tone="record.headset === 'normal' ? 'teal' : 'red'" />
            </template>
            <template v-else-if="column.key === 'calls_today'">
              <span class="num">{{ record.calls_today }}</span>
            </template>
            <template v-else-if="column.key === 'op_status'">
              <a-select
                :value="record.op_status"
                size="small"
                style="width: 100px"
                :bordered="false"
                @change="(v) => changeStatus(record, v)"
              >
                <a-select-option v-for="(v, k) in POSITION_STATUS" :key="k" :value="k">
                  <span class="dot" :style="{ background: v.dot, marginRight: '6px' }" />{{ v.label }}
                </a-select-option>
              </a-select>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-button type="link" size="small" danger @click="remove(record)">删除</a-button>
            </template>
          </template>
        </a-table>
      </div>
    </div>

    <a-modal
      v-model:open="modal.open"
      :title="modal.mode === 'create' ? '新增席位' : `编辑席位 · ${form.code}`"
      :confirm-loading="modal.saving"
      width="580px"
      ok-text="保存"
      cancel-text="取消"
      @ok="save"
    >
      <a-form layout="vertical" style="margin-top: 8px">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px">
          <a-form-item label="席位编号" required>
            <a-input v-model:value="form.code" placeholder="如 TWR-01" />
          </a-form-item>
          <a-form-item label="席位名称" required>
            <a-input v-model:value="form.name" placeholder="如 塔台管制主用席" />
          </a-form-item>
          <a-form-item label="所属扇区" required>
            <a-select v-model:value="form.sector">
              <a-select-option v-for="s in SECTORS" :key="s" :value="s">{{ s }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="席位类型">
            <a-select v-model:value="form.type">
              <a-select-option v-for="(v, k) in POSITION_TYPE" :key="k" :value="k">{{ v.label }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="默认信道">
            <a-select v-model:value="form.default_channel_id" allow-clear placeholder="选择默认信道">
              <a-select-option v-for="c in channels" :key="c.id" :value="c.id">{{ c.code }} · {{ c.freq }} MHz</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="值守人员">
            <a-input v-model:value="form.operator" placeholder="如 张明远" />
          </a-form-item>
          <a-form-item label="运行状态">
            <a-select v-model:value="form.op_status">
              <a-select-option v-for="(v, k) in POSITION_STATUS" :key="k" :value="k">{{ v.label }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="耳机状态">
            <a-select v-model:value="form.headset">
              <a-select-option value="normal">正常</a-select-option>
              <a-select-option value="fault">异常</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="终端 IP">
            <a-input v-model:value="form.ip" placeholder="如 10.20.1.11" />
          </a-form-item>
        </div>
        <a-form-item label="备注">
          <a-textarea v-model:value="form.remark" :rows="2" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
