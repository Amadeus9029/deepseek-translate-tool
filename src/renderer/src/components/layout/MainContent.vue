<script setup lang="ts">
import { computed, watch, onMounted, nextTick, ref } from 'vue'

const props = defineProps({
  selectedMenu: {
    type: String,
    required: true
  },
  componentKey: {
    type: String,
    required: true
  },
  currentComponent: {
    type: Object,
    required: true
  },
  menuItems: {
    type: Array as () => any[],
    required: false
  }
})

const displayTitle = computed(() => {
  if (props.menuItems) {
    const item = (props.menuItems as any[]).find((item: any) => item.key === props.selectedMenu)
    return item ? item.title : props.selectedMenu
  }
  return props.selectedMenu
})

const mainContentWrapperRef = ref<HTMLElement | null>(null)
let lastScrollTop = 0

// 记录滚动条位置
function saveScroll() {
  if (mainContentWrapperRef.value) {
    lastScrollTop = mainContentWrapperRef.value.scrollTop
  }
}

// 恢复滚动条位置
function restoreScroll() {
  if (mainContentWrapperRef.value) {
    mainContentWrapperRef.value.scrollTop = lastScrollTop
  }
}

// 监听componentKey变化（如语言切换），恢复滚动条
watch(() => props.componentKey, async () => {
  await nextTick()
  restoreScroll()
})

onMounted(() => {
  restoreScroll()
})
</script>

<template>
  <div class="main-bg">
    <div class="main-header">
      <span class="main-title">{{ displayTitle }}</span>
    </div>
    <v-main data-v-7a7a37b1 class="v-main no-scrollbar"
      style="--v-layout-left: 210px; --v-layout-right: 0px; --v-layout-top: 0px; --v-layout-bottom: 0px;">
      <div class="main-content-wrapper" ref="mainContentWrapperRef" @scroll="saveScroll">
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