<script setup lang="ts">
defineProps({
  title: {
    type: String,
    default: ''
  },
  flat: {
    type: Boolean,
    default: true
  }
})
</script>

<template>
  <div class="page-container">
    <v-card class="translate-card" :flat="flat">
      <v-card-title v-if="title" class="translate-title">{{ title }}</v-card-title>
      <v-card-text>
        <slot></slot>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.page-container {
  width: 100%;
  height: 100%;
  padding: 16px;
}

.translate-card {
  width: 100%;
  height: 100%;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-surface-variant));
  border-radius: 8px;
}

.translate-title {
  font-size: 24px;
  font-weight: bold;
  padding-bottom: 16px;
}
</style> 