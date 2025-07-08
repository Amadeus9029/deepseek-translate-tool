<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from 'vuetify'
import { useI18n } from 'vue-i18n'

interface MenuItem {
  key: string
  title: string
  icon: string
}

const props = defineProps({
  selectedMenu: String,
  menuItems: {
    type: Array as () => MenuItem[],
    required: true
  }
})

const emit = defineEmits(['menuSelect'])
const { t } = useI18n()

const theme = useTheme()
// 计算当前是否是深色模式
const isDark = computed(() => theme.global.current.value.dark)
</script>

<template>
  <v-navigation-drawer
    permanent
    class="sidebar"
    :class="{ 'theme--dark': isDark }"
  >
    <div class="sidebar-header d-flex align-center">
      <v-icon size="32" :color="isDark ? 'white' : 'primary'" class="mr-2">mdi-translate</v-icon>
      <span class="app-title">{{ t('common.appName', '智能翻译工具') }}</span>
    </div>
    <v-list class="sidebar-list">
      <v-list-item
        v-for="item in menuItems"
        :key="item.key"
        :title="item.title"
        :prepend-icon="item.icon"
        :active="selectedMenu === item.key"
        @click="emit('menuSelect', item.key)"
        class="sidebar-list-item"
        :class="{ 'sidebar-list-item--active': selectedMenu === item.key }"
      >
        <template #title>
          <span :class="{ 'active-title': selectedMenu === item.key }">{{ item.title }}</span>
        </template>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>

<style scoped>
.sidebar {
  flex-shrink: 0;
  width: 210px !important;
  padding-top: 0;
}

.sidebar.theme--dark {
  border-right-color: rgba(255, 255, 255, 0.12);
}

.sidebar-header {
  height: 56px;
  padding: 0 20px;
  margin-top: 20px;
  font-size: 20px;
  font-weight: bold;
  background: rgb(var(--v-theme-surface));
  user-select: none;
}

.app-title {
  font-size: 20px;
  font-weight: bold;
  color: rgb(var(--v-theme-on-surface));
}

.sidebar-list {
  margin-top: 8px;
}

.sidebar-list-item {
  margin: 4px 0;
  border-radius: 8px !important;
  padding-left: 16px !important;
  padding-right: 16px !important;
  width: calc(100% - 16px);
  margin-left: 8px;
  margin-right: 8px;
  transition: background 0.2s;
}

.sidebar-list-item--active {
  background: rgba(var(--v-theme-primary), 0.12) !important;
  color: rgb(var(--v-theme-on-surface)) !important;
  font-weight: bold;
  border-radius: 16px;
}

.active-title {
  font-weight: bold;
  color: rgb(var(--v-theme-on-surface));
}
</style> 