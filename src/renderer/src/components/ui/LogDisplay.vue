<script setup lang="ts">
defineProps({
  logs: {
    type: Array as () => string[],
    default: () => []
  },
  title: {
    type: String,
    default: '运行日志'
  },
  emptyText: {
    type: String,
    default: '暂无日志信息'
  },
  height: {
    type: String,
    default: '200px'
  }
})
</script>

<template>
  <div class="section">
    <div class="section-title">{{ title }}</div>
    <div class="log-container" :style="{ height }">
      <div v-if="logs.length === 0" class="empty-log">
        {{ emptyText }}
      </div>
      <div v-else class="log-content">
        <div v-for="(log, index) in logs" :key="index" class="log-item">
          {{ log }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
  color: rgb(var(--v-theme-on-surface));
}

.log-container {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-surface-variant));
  border-radius: 4px;
  padding: 16px;
  overflow-y: auto;
}

.empty-log {
  color: rgba(var(--v-theme-on-surface), 0.6);
  text-align: center;
  padding: 16px;
}

.log-item {
  padding: 4px 0;
  color: rgb(var(--v-theme-on-surface));
}

.log-container::-webkit-scrollbar {
  width: 8px;
  background: transparent;
}

.log-container::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 4px;
}

.log-container::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--v-theme-on-surface), 0.3);
}
</style> 