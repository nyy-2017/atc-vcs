<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { LockOutlined, SafetyCertificateOutlined, UserOutlined, WifiOutlined, ThunderboltOutlined } from '@ant-design/icons-vue';
import { useAuthStore } from '../store/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const formRef = ref();

const form = reactive({ username: 'admin', password: 'admin123' });

const rules = {
  username: [{ required: true, message: '请输入用户名' }],
  password: [{ required: true, message: '请输入密码' }],
};

const demos = [
  { username: 'admin', password: 'admin123', label: '系统管理员', desc: '全部权限' },
  { username: 'supervisor', password: 'super123', label: '主任管制员', desc: '监控与告警' },
  { username: 'controller', password: 'ctrl123', label: '管制员', desc: '通信指挥' },
];

function useDemo(d) {
  form.username = d.username;
  form.password = d.password;
}

async function submit() {
  try {
    await formRef.value.validate();
  } catch {
    return;
  }
  try {
    const user = await auth.login({ ...form });
    message.success(`欢迎回来，${user.real_name}`);
    router.replace(route.query.redirect || '/dashboard');
  } catch (e) {
    message.error(e.message);
  }
}

onMounted(() => {
  if (auth.isLogin) router.replace('/dashboard');
});
</script>

<template>
  <div class="login-wrap">
    <section class="login-hero">
      <div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 28px">
          <div class="brand-badge">ATC</div>
          <div>
            <div style="font-weight: 700; letter-spacing: 0.3px">空管语音通信交换系统</div>
            <div class="brand-sub">ATC VOICE SWITCHING SYSTEM</div>
          </div>
        </div>

        <h1>地空话音<br />一体化交换与调度平台</h1>
        <p class="lead">
          面向塔台、进近、区域管制及机坪管制的多席位话音交换系统，提供主备频率自动切换、
          实时 PTT 调度、链路质量监测、全程录音与审计追溯能力。
        </p>

        <div class="login-feats">
          <div class="login-feat"><WifiOutlined style="color: #1d5cf6" /> 12 路 VHF/UHF 信道接入</div>
          <div class="login-feat"><ThunderboltOutlined style="color: #0fae9a" /> 主备频率秒级切换</div>
          <div class="login-feat"><SafetyCertificateOutlined style="color: #f0a020" /> 全程录音与质量评估</div>
          <div class="login-feat"><UserOutlined style="color: #1d5cf6" /> 三级角色分级授权</div>
        </div>
      </div>

      <div style="position: relative; max-width: 460px">
        <svg viewBox="0 0 460 230" width="100%" height="230" style="display: block">
          <defs>
            <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#1d5cf6" stop-opacity="0.22" />
              <stop offset="100%" stop-color="#1d5cf6" stop-opacity="0" />
            </linearGradient>
          </defs>
          <g transform="translate(230,118)">
            <circle r="104" fill="none" stroke="#cfe0fb" stroke-width="1" />
            <circle r="78" fill="none" stroke="#dbe8fb" stroke-width="1" />
            <circle r="52" fill="none" stroke="#e3edfc" stroke-width="1" />
            <circle r="26" fill="none" stroke="#e9f1fc" stroke-width="1" />
            <line x1="-112" y1="0" x2="112" y2="0" stroke="#e6eefb" stroke-width="1" />
            <line x1="0" y1="-112" x2="0" y2="112" stroke="#e6eefb" stroke-width="1" />
            <path d="M0,0 L104,0 A104,104 0 0,0 74,-73 Z" fill="url(#sweep)" />
            <circle cx="62" cy="-42" r="4" fill="#0fae9a" opacity="0.9" />
            <circle cx="-54" cy="34" r="3.4" fill="#1d5cf6" opacity="0.85" />
            <circle cx="30" cy="66" r="2.8" fill="#f0a020" opacity="0.9" />
            <circle cx="-76" cy="-30" r="2.6" fill="#1d5cf6" opacity="0.6" />
            <circle r="5" fill="#1d5cf6" />
          </g>
          <text x="14" y="22" font-size="9" fill="#96a8c4" letter-spacing="2">CHANNEL MATRIX · LIVE</text>
          <text x="336" y="222" font-size="9" fill="#96a8c4" letter-spacing="1">ZBAA / 118.100</text>
        </svg>
        <div style="display: flex; gap: 26px; margin-top: 4px; color: var(--atc-text-2); font-size: 12px">
          <div><span class="num" style="font-size: 20px; font-weight: 700; color: #16233a">12</span> 路信道</div>
          <div><span class="num" style="font-size: 20px; font-weight: 700; color: #16233a">8</span> 个席位</div>
          <div><span class="num" style="font-size: 20px; font-weight: 700; color: #16233a">99.99%</span> 可用性</div>
        </div>
      </div>
    </section>

    <section class="login-form-side">
      <div class="login-form">
        <h2>登录控制台</h2>
        <div class="sub">请使用管制员或管理员账号访问系统</div>

        <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" @finish="submit">
          <a-form-item label="用户名" name="username">
            <a-input v-model:value="form.username" size="large" placeholder="请输入用户名" allow-clear>
              <template #prefix><UserOutlined style="color: #a8b4c8" /></template>
            </a-input>
          </a-form-item>
          <a-form-item label="密码" name="password">
            <a-input-password v-model:value="form.password" size="large" placeholder="请输入密码" @press-enter="submit">
              <template #prefix><LockOutlined style="color: #a8b4c8" /></template>
            </a-input-password>
          </a-form-item>

          <a-button type="primary" size="large" block :loading="auth.loading" html-type="submit" style="height: 42px">
            登录系统
          </a-button>
        </a-form>

        <div style="margin-top: 22px">
          <div style="font-size: 11.5px; color: var(--atc-text-3); margin-bottom: 8px">演示账号（点击填充）</div>
          <div style="display: flex; gap: 8px">
            <div
              v-for="d in demos"
              :key="d.username"
              style="
                flex: 1;
                border: 1px solid #e4ebf5;
                border-radius: 8px;
                padding: 8px 9px;
                cursor: pointer;
                background: #fbfdff;
              "
              @click="useDemo(d)"
            >
              <div style="font-size: 12px; font-weight: 600">{{ d.label }}</div>
              <div style="font-size: 10.5px; color: #8d9bb2; margin-top: 2px">{{ d.desc }}</div>
            </div>
          </div>
        </div>

        <div class="login-tip">
          本系统为内网部署环境，所有操作均记录审计日志。<br />
          数据存储于本地 SQLite 数据库，重启服务后自动恢复。
        </div>
      </div>
    </section>
  </div>
</template>
