<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  unit: { type: String, default: '' },
  foot: { type: String, default: '' },
  tone: { type: String, default: 'blue' },
  icon: { type: Object, default: null },
});
const tones = {
  blue: { fg: '#1d5cf6', bg: '#eaf1ff' },
  teal: { fg: '#0fae9a', bg: '#e3f8f4' },
  amber: { fg: '#e08c00', bg: '#fff5e3' },
  red: { fg: '#e8453c', bg: '#fdeceb' },
};
</script>

<template>
  <div class="stat-card">
    <div class="stat-label">{{ label }}</div>
    <div class="stat-value">
      {{ value }}<span v-if="unit" class="stat-unit">{{ unit }}</span>
    </div>
    <div v-if="foot" class="stat-foot">{{ foot }}</div>
    <div class="stat-ico" :style="{ background: tones[tone].bg, color: tones[tone].fg }">
      <component :is="icon" v-if="icon" />
    </div>
  </div>
</template>
