<script setup>
import { onMounted, reactive, ref } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { api } from '../api';
import { ROLE, USER_STATUS } from '../utils/dict';
import StatusBadge from '../components/StatusBadge.vue';

const list = ref([]);
const positions = ref([]);
const loading = ref(false);
const keyword = ref('');
const modal = reactive({ open: false, mode: 'create', saving: false, id: null });
const blank = () => ({ username: '', password: '', real_name: '', role: 'controller', position_id: null, phone: '', status: 'active' });
const form = reactive(blank());

const columns = [
  { title: '用户名', dataIndex: 'username', key: 'username', width: 120 },
  { title: '姓名', dataIndex: 'real_name', key: 'real_name', width: 100 },
  { title: '角色', dataIndex: 'role', key: 'role', width: 118 },
  { title: '绑定席位', key: 'position', width: 110 },
  { title: '联系电话', dataIndex: 'phone', key: 'phone', width: 130 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '最近登录', dataIndex: 'last_login', key: 'last_login', width: 156 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 156 },
  { title: '操作', key: 'action', width: 120, fixed: 'right' },
];

async function load() {
  loading.value = true;
  try {
    const res = await api.users.list({ keyword: keyword.value });
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
  Object.assign(form, blank(), { ...row, password: '' });
  modal.id = row.id;
  modal.mode = 'edit';
  modal.open = true;
}

async function save() {
  if (!form.username || !form.real_name || (modal.mode === 'create' && !form.password)) {
    message.warning('请填写用户名、姓名与初始密码');
    return;
  }
  modal.saving = true;
  try {
    if (modal.mode === 'create') {
      await api.users.create({ ...form });
      message.success('用户已创建');
    } else {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      await api.users.update(modal.id, payload);
      message.success('用户已更新');
    }
    modal.open = false;
    load();
  } catch (e) {
    message.error(e.message);
  } finally {
    modal.saving = false;
  }
}

function remove(row) {
  Modal.confirm({
    title: `删除用户 ${row.username}？`,
    content: '删除后该账号将无法登录本系统。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await api.users.remove(row.id);
        message.success('用户已删除');
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
        <h2>用户与权限</h2>
        <p>系统管理员、主任管制员与管制员三级权限，按席位分配操作范围</p>
      </div>
      <div class="toolbar">
        <a-button @click="load"><template #icon><ReloadOutlined /></template>刷新</a-button>
        <a-button type="primary" @click="openCreate"><template #icon><PlusOutlined /></template>新增用户</a-button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-body" style="padding-bottom: 6px">
        <div class="filter-bar">
          <a-input v-model:value="keyword" placeholder="搜索用户名 / 姓名" style="width: 240px" allow-clear @press-enter="load">
            <template #prefix><SearchOutlined style="color: #a8b4c8" /></template>
          </a-input>
          <a-button type="primary" ghost @click="load">查询</a-button>
          <span style="color: var(--atc-text-3); font-size: 12px">共 {{ list.length }} 个账号</span>
        </div>

        <a-table
          :columns="columns"
          :data-source="list"
          :loading="loading"
          row-key="id"
          size="middle"
          :scroll="{ x: 1080 }"
          :pagination="{ pageSize: 10, showSizeChanger: false }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'username'">
              <span class="mono" style="font-weight: 600">{{ record.username }}</span>
            </template>
            <template v-else-if="column.key === 'role'">
              <StatusBadge :label="ROLE[record.role]?.label" :tone="ROLE[record.role]?.cls" />
            </template>
            <template v-else-if="column.key === 'position'">
              <span class="mono">{{ record.position_code || '—' }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <StatusBadge :label="USER_STATUS[record.status]?.label" :tone="USER_STATUS[record.status]?.cls" dot :dot-color="record.status === 'active' ? '#0fae9a' : '#8d9bb2'" />
            </template>
            <template v-else-if="column.key === 'last_login'">
              <span class="mono" style="font-size: 12px">{{ record.last_login || '从未登录' }}</span>
            </template>
            <template v-else-if="column.key === 'created_at'">
              <span class="mono" style="font-size: 12px">{{ record.created_at }}</span>
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
      :title="modal.mode === 'create' ? '新增用户' : `编辑用户 · ${form.username}`"
      :confirm-loading="modal.saving"
      ok-text="保存"
      cancel-text="取消"
      @ok="save"
    >
      <a-form layout="vertical" style="margin-top: 8px">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px">
          <a-form-item label="用户名" required>
            <a-input v-model:value="form.username" :disabled="modal.mode === 'edit'" placeholder="登录账号" />
          </a-form-item>
          <a-form-item :label="modal.mode === 'create' ? '初始密码' : '重置密码（留空不修改）'">
            <a-input-password v-model:value="form.password" placeholder="请输入密码" />
          </a-form-item>
          <a-form-item label="姓名" required>
            <a-input v-model:value="form.real_name" />
          </a-form-item>
          <a-form-item label="角色">
            <a-select v-model:value="form.role">
              <a-select-option v-for="(v, k) in ROLE" :key="k" :value="k">{{ v.label }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="绑定席位">
            <a-select v-model:value="form.position_id" allow-clear placeholder="可绑定管制席位">
              <a-select-option v-for="p in positions" :key="p.id" :value="p.id">{{ p.code }} · {{ p.name }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="联系电话">
            <a-input v-model:value="form.phone" />
          </a-form-item>
          <a-form-item label="账号状态">
            <a-select v-model:value="form.status">
              <a-select-option value="active">启用</a-select-option>
              <a-select-option value="disabled">停用</a-select-option>
            </a-select>
          </a-form-item>
        </div>
      </a-form>
    </a-modal>
  </div>
</template>
