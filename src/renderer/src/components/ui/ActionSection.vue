<script setup lang="ts">
defineProps({
  statusText: {
    type: String,
    default: ''
  },
  showStatus: {
    type: Boolean,
    default: false
  }
})
</script>

<template>
  <div class="action-section">
    <slot></slot>
    <div v-if="showStatus && statusText" class="status-section">
      {{ statusText }}
    </div>
  </div>
</template>

<style scoped>
.action-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
}

.status-section {
  width: 100%;
  padding: 12px 16px;
  border-radius: 6px;
  background: rgba(var(--v-theme-primary), 0.08);
  color: rgb(var(--v-theme-on-surface));
  text-align: center;
  font-size: 14px;
  line-height: 1.4;
}
</style> 