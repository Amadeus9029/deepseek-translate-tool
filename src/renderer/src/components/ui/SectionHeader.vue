<script setup lang="ts">
defineProps({
  title: {
    type: String,
    required: true
  }
})
</script>

<template>
  <div class="section-title">{{ title }}</div>
</template>

<style scoped>
.section-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
  color: rgb(var(--v-theme-on-surface));
}
</style> 