<script setup>
defineProps({
  label: { type: String, required: true },
  tone: { type: String, default: 'gray' },
  dot: { type: Boolean, default: false },
  dotColor: { type: String, default: '' },
});
</script>

<template>
  <span class="soft-badge" :class="tone">
    <span v-if="dot" class="dot" :style="{ background: dotColor || 'currentColor' }" />
    {{ label }}
  </span>
</template>
