<script setup>
import { onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { DatabaseOutlined, SafetyOutlined, SaveOutlined, SettingOutlined, ThunderboltOutlined } from '@ant-design/icons-vue';
import { api } from '../api';
import { realtimeState } from '../api/realtime';

const saving = ref(false);
const loaded = ref(false);
const health = ref(null);

const form = reactive({
  system_name: '空管语音通信交换系统',
  station: 'ZBAA 北京区域管制中心',
  auto_standby: true,
  record_days: 90,
  ptt_timeout: 30,
  alarm_sound: true,
  quality_threshold: 85,
});

function applyValues(map) {
  for (const k of Object.keys(form)) {
    if (map[k] === undefined) continue;
    if (typeof form[k] === 'boolean') form[k] = map[k] === 'true';
    else if (typeof form[k] === 'number') form[k] = Number(map[k]);
    else form[k] = map[k];
  }
}

async function load() {
  try {
    const res = await api.settings.get();
    applyValues(res.data || {});
    loaded.value = true;
  } catch (e) {
    message.error(e.message);
  }
  try {
    const h = await fetch('/api/health').then((r) => r.json());
    health.value = h.data;
  } catch {
    /* 忽略 */
  }
}

async function save() {
  saving.value = true;
  try {
    const payload = {};
    for (const [k, v] of Object.entries(form)) payload[k] = String(v);
    await api.settings.save(payload);
    message.success('系统配置已保存');
  } catch (e) {
    message.error(e.message);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h2>系统设置</h2>
        <p>配置系统名称、主备切换策略、录音保留周期与语音质量阈值</p>
      </div>
      <a-button type="primary" :loading="saving" @click="save">
        <template #icon><SaveOutlined /></template>保存配置
      </a-button>
    </div>

    <div class="grid" style="grid-template-columns: minmax(0, 1.5fr) minmax(300px, 1fr)">
      <div class="panel">
        <div class="panel-head"><div class="t">基础配置</div></div>
        <div class="panel-body">
          <a-form layout="vertical">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px">
              <a-form-item label="系统名称">
                <a-input v-model:value="form.system_name" />
              </a-form-item>
              <a-form-item label="所属单位 / 台站">
                <a-input v-model:value="form.station" />
              </a-form-item>
              <a-form-item label="录音保留天数">
                <a-input-number v-model:value="form.record_days" :min="7" :max="365" style="width: 100%" addon-after="天" />
              </a-form-item>
              <a-form-item label="PTT 超时释放">
                <a-input-number v-model:value="form.ptt_timeout" :min="5" :max="120" style="width: 100%" addon-after="秒" />
              </a-form-item>
              <a-form-item label="语音质量告警阈值">
                <a-input-number v-model:value="form.quality_threshold" :min="60" :max="100" style="width: 100%" addon-after="分" />
              </a-form-item>
            </div>

            <div style="border-top: 1px dashed var(--atc-border); margin: 6px 0 14px"></div>

            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0">
              <div>
                <div style="font-size: 13px; font-weight: 600">主备频率自动切换</div>
                <div style="font-size: 11.5px; color: var(--atc-text-3); margin-top: 3px">主用信道故障时，自动将话音链路切换至同扇区备用频率</div>
              </div>
              <a-switch v-model:checked="form.auto_standby" />
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0">
              <div>
                <div style="font-size: 13px; font-weight: 600">告警声音提示</div>
                <div style="font-size: 11.5px; color: var(--atc-text-3); margin-top: 3px">紧急与重要级别告警到达时播放提示音</div>
              </div>
              <a-switch v-model:checked="form.alarm_sound" />
            </div>
          </a-form>
        </div>
      </div>

      <div class="grid" style="gap: 14px; align-content: start">
        <div class="panel">
          <div class="panel-head"><div class="t">系统信息</div></div>
          <div class="panel-body">
            <div class="detail-row"><span class="k">系统版本</span><span class="v mono">ATC-VCS v1.0.0</span></div>
            <div class="detail-row"><span class="k">服务状态</span><span class="v"><span class="dot" style="background: #0fae9a; margin-right: 6px" />{{ health?.status || 'UP' }}</span></div>
            <div class="detail-row"><span class="k">实时链路</span><span class="v">{{ realtimeState.connected ? '已连接 (SSE)' : '未连接' }}</span></div>
            <div class="detail-row"><span class="k">数据库</span><span class="v mono">SQLite / atc-vcs.db</span></div>
            <div class="detail-row"><span class="k">服务端时间</span><span class="v mono">{{ health ? new Date(health.time).toLocaleString('zh-CN') : '—' }}</span></div>
            <div class="detail-row"><span class="k">前端技术栈</span><span class="v">Vue 3 · Ant Design Vue 4 · Vite</span></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><div class="t">部署说明</div></div>
          <div class="panel-body" style="font-size: 12px; line-height: 2; color: var(--atc-text-2)">
            <div><ThunderboltOutlined style="color: #1d5cf6" /> 后端 Node.js + Express，默认端口 3001</div>
            <div><DatabaseOutlined style="color: #0fae9a" /> 数据持久化于 server/data/atc-vcs.db</div>
            <div><SafetyOutlined style="color: #f0a020" /> 所有写操作写入审计日志</div>
            <div><SettingOutlined style="color: #5c6b85" /> 前端构建产物由后端统一托管</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
