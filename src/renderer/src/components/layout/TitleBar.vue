<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from 'vuetify'

const props = defineProps({
  isMaximized: Boolean,
  isAlwaysOnTop: Boolean
})

const emit = defineEmits(['minimize', 'toggleMaximize', 'close', 'toggleAlwaysOnTop'])

const theme = useTheme()
// 计算当前是否是深色模式
const isDark = computed(() => theme.global.current.value.dark)
</script>

<template>
  <div class="custom-title-bar" :class="{ 'theme--dark': isDark }" @dblclick="emit('toggleMaximize')">
    <div class="title-bar-left">
      <v-icon size="28" :color="isDark ? 'white' : 'primary'" class="app-logo">mdi-translate</v-icon>
      <span class="app-title">智能翻译工具</span>
    </div>
    <div class="title-bar-btns">
      <button class="title-btn" @click="emit('toggleAlwaysOnTop')" title="置顶">
        <v-icon size="18">{{ isAlwaysOnTop ? 'mdi-pin' : 'mdi-pin-outline' }}</v-icon>
      </button>
      <button class="title-btn" @click="emit('minimize')" title="最小化">
        <v-icon size="18">mdi-window-minimize</v-icon>
      </button>
      <button class="title-btn" @click="emit('toggleMaximize')" title="最大化/还原">
        <v-icon size="18">{{ isMaximized ? 'mdi-window-restore' : 'mdi-window-maximize' }}</v-icon>
      </button>
      <button class="title-btn close-btn" @click="emit('close')" title="关闭">
        <v-icon size="18">mdi-close</v-icon>
      </button>
    </div>
  </div>
</template>

<style scoped>
.custom-title-bar {
  height: 40px;
  background: rgb(var(--v-theme-surface));
  display: flex;
  align-items: center;
  justify-content: space-between;
  -webkit-app-region: drag;
  user-select: none;
  padding: 0 16px 0 16px;
  flex-shrink: 0;
  z-index: 1000;
}
.custom-title-bar.theme--dark {
  border-bottom-color: rgba(255, 255, 255, 0.12);
}
.title-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.title-bar-btns {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}
.title-btn {
  width: 36px;
  height: 36px;
  border: none;
  outline: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.18s, color 0.18s;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  font-size: 18px;
  padding: 0;
  border-radius: 6px;
}
.title-btn:hover {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}
.close-btn {
  color: rgb(var(--v-theme-on-surface));
}
.close-btn:hover {
  background: #ff4d4f;
  color: #fff;
}
.theme--dark .title-btn {
  color: rgba(255, 255, 255, 0.8);
}
.theme--dark .close-btn {
  color: rgba(255, 255, 255, 0.8);
}
.app-logo {
  color: rgb(var(--v-theme-primary));
}
.app-title {
  font-size: 20px;
  font-weight: bold;
  color: rgb(var(--v-theme-on-surface));
  margin-left: 4px;
}
</style> 