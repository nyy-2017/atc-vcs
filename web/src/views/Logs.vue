<script setup>
import { onMounted, reactive, ref } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { ClearOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { api } from '../api';
import { useAuthStore } from '../store/auth';
import StatusBadge from '../components/StatusBadge.vue';

const auth = useAuthStore();
const list = ref([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const size = ref(12);
const filters = reactive({ keyword: '', module: undefined, date: '' });

const modules = ['系统', '通信指挥台', '信道管理', '席位管理', '通话记录', '告警管理', '用户管理', '日志审计', '系统设置'];

const columns = [
  { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 168 },
  { title: '操作人', dataIndex: 'user_name', key: 'user_name', width: 110 },
  { title: '模块', dataIndex: 'module', key: 'module', width: 120 },
  { title: '动作', dataIndex: 'action', key: 'action', width: 110 },
  { title: '详情', dataIndex: 'detail', key: 'detail' },
  { title: '来源 IP', dataIndex: 'ip', key: 'ip', width: 132 },
];

async function load() {
  loading.value = true;
  try {
    const res = await api.logs.list({ ...filters, page: page.value, size: size.value });
    list.value = res.data.list;
    total.value = res.data.total;
  } catch (e) {
    message.error(e.message);
  } finally {
    loading.value = false;
  }
}

function clearLogs() {
  Modal.confirm({
    title: '确认清理全部审计日志？',
    content: '该操作不可恢复，仅管理员可执行。',
    okText: '确认清理',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await api.logs.clear();
        message.success('日志已清理');
        page.value = 1;
        load();
      } catch (e) {
        message.error(e.message);
      }
    },
  });
}

onMounted(load);
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h2>操作日志</h2>
        <p>记录登录、信道变更、通话调度与告警处置等关键操作，满足审计追溯要求</p>
      </div>
      <div class="toolbar">
        <a-button @click="load"><template #icon><ReloadOutlined /></template>刷新</a-button>
        <a-button v-if="auth.isAdmin" danger @click="clearLogs"><template #icon><ClearOutlined /></template>清理日志</a-button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-body" style="padding-bottom: 6px">
        <div class="filter-bar">
          <a-input v-model:value="filters.keyword" placeholder="搜索操作人 / 动作 / 详情" style="width: 250px" allow-clear @press-enter="page = 1; load()">
            <template #prefix><SearchOutlined style="color: #a8b4c8" /></template>
          </a-input>
          <a-select v-model:value="filters.module" placeholder="全部模块" style="width: 150px" allow-clear @change="page = 1; load()">
            <a-select-option v-for="m in modules" :key="m" :value="m">{{ m }}</a-select-option>
          </a-select>
          <a-date-picker v-model:value="filters.date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 150px" @change="page = 1; load()" />
          <a-button type="primary" ghost @click="page = 1; load()">查询</a-button>
          <span style="color: var(--atc-text-3); font-size: 12px">共 {{ total }} 条记录</span>
        </div>

        <a-table
          :columns="columns"
          :data-source="list"
          :loading="loading"
          row-key="id"
          size="middle"
          :scroll="{ x: 980 }"
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
            <template v-if="column.key === 'created_at'">
              <span class="mono" style="font-size: 12px">{{ record.created_at }}</span>
            </template>
            <template v-else-if="column.key === 'user_name'">
              {{ record.user_name }}
            </template>
            <template v-else-if="column.key === 'module'">
              <StatusBadge :label="record.module" tone="blue" />
            </template>
            <template v-else-if="column.key === 'action'">
              {{ record.action }}
            </template>
            <template v-else-if="column.key === 'detail'">
              <span style="color: var(--atc-text-2)">{{ record.detail }}</span>
            </template>
            <template v-else-if="column.key === 'ip'">
              <span class="mono" style="font-size: 12px">{{ record.ip }}</span>
            </template>
          </template>
        </a-table>
      </div>
    </div>
  </div>
</template>
