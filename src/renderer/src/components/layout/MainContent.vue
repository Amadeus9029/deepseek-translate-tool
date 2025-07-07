<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  selectedMenu: {
    type: String,
    required: true
  },
  componentKey: {
    type: Number,
    required: true
  },
  currentComponent: {
    type: Object,
    required: true
  }
})
</script>

<template>
  <div class="main-bg">
    <div class="main-header">
      <span class="main-title">{{ selectedMenu }}</span>
    </div>
    <v-main data-v-7a7a37b1 class="v-main no-scrollbar"
      style="--v-layout-left: 210px; --v-layout-right: 0px; --v-layout-top: 0px; --v-layout-bottom: 0px;">
      <div class="main-content-wrapper">
        <keep-alive>
          <component :is="currentComponent" :key="componentKey" />
        </keep-alive>
      </div>
    </v-main>
  </div>
</template>

<style scoped>
.main-bg {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
  background: rgb(var(--v-theme-background));
}

.main-bg::-webkit-scrollbar {
  display: none;
}

.main-content-wrapper {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  min-width: 0;
  background: transparent;
  height: calc(100vh - 40px - 32px);
  width: 100%;
  margin: 0;
  padding: 8px;
  box-sizing: border-box;
}

.main-header {
  height: 40px;
  background: rgb(var(--v-theme-surface));
  display: flex;
  align-items: center;
  padding: 0 24px;
  margin-left: 210px;
  padding-bottom: 24px;
}

.main-title {
  font-size: 20px;
  font-weight: bold;
  color: rgb(var(--v-theme-on-surface));
}

.v-main {
  padding-top: 0 !important;
  overflow-y: auto;
}

.v-main::-webkit-scrollbar {
  width: 8px;
  background: transparent;
}

.v-main::-webkit-scrollbar-thumb {
  background: #e0e0e0;
  border-radius: 6px;
  min-height: 40px;
  transition: background 0.2s;
}

.v-main::-webkit-scrollbar-thumb:hover {
  background: #bdbdbd;
}

.v-main::-webkit-scrollbar-corner {
  background: transparent;
}

.no-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style> 