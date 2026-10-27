<script setup>
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');

const theme = {
  token: {
    colorPrimary: '#1d5cf6',
    colorInfo: '#1d5cf6',
    colorSuccess: '#0fae9a',
    colorWarning: '#f0a020',
    colorError: '#e8453c',
    borderRadius: 8,
    fontSize: 13,
    colorText: '#16233a',
    colorTextSecondary: '#5c6b85',
    colorBorder: '#e4ebf5',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
  },
  components: {
    Table: { headerBg: '#f7fafe', headerColor: '#5c6b85', rowHoverBg: '#f5f9ff', borderColor: '#eef3fa' },
    Menu: { itemSelectedBg: '#eaf1ff', itemSelectedColor: '#1d5cf6', itemBorderRadius: 8, itemHeight: 42 },
    Card: { paddingLG: 18 },
  },
};
</script>

<template>
  <a-config-provider :locale="zhCN" :theme="theme">
    <router-view />
  </a-config-provider>
</template>
