<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';

const props = defineProps({
  option: { type: Object, default: () => ({}) },
  height: { type: String, default: '260px' },
});

const el = ref(null);
let chart = null;
let ro = null;

onMounted(() => {
  chart = echarts.init(el.value, null, { renderer: 'canvas' });
  chart.setOption(props.option || {});
  ro = new ResizeObserver(() => chart && chart.resize());
  ro.observe(el.value);
});

watch(
  () => props.option,
  (v) => {
    if (chart && v) chart.setOption(v, true);
  },
  { deep: true }
);

onBeforeUnmount(() => {
  ro && ro.disconnect();
  chart && chart.dispose();
  chart = null;
});
</script>

<template>
  <div ref="el" :style="{ width: '100%', height }"></div>
</template>
