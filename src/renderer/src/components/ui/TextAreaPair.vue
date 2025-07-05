<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'

const { t } = useI18n()

const props = defineProps({
  sourceText: {
    type: String,
    default: ''
  },
  translatedText: {
    type: String,
    default: ''
  },
  sourceTitle: {
    type: String,
    default: ''
  },
  targetTitle: {
    type: String,
    default: ''
  },
  sourcePlaceholder: {
    type: String,
    default: ''
  },
  targetPlaceholder: {
    type: String,
    default: ''
  },
  sourceDisabled: {
    type: Boolean,
    default: false
  },
  targetReadonly: {
    type: Boolean,
    default: true
  },
  rows: {
    type: Number,
    default: 8
  },
  autoGrow: {
    type: Boolean,
    default: true
  }
})

// 使用计算属性来处理默认值
const computedSourceTitle = computed(() => props.sourceTitle || t('textTranslate.sourceText'))
const computedTargetTitle = computed(() => props.targetTitle || t('textTranslate.translatedText'))
const computedSourcePlaceholder = computed(() => props.sourcePlaceholder || t('textTranslate.emptySourceText'))
const computedTargetPlaceholder = computed(() => props.targetPlaceholder || t('textTranslate.translatedText'))

const emit = defineEmits(['update:sourceText', 'update:translatedText', 'clearSource', 'copyResult'])

const updateSourceText = (value: string) => {
  emit('update:sourceText', value)
}

const updateTranslatedText = (value: string) => {
  emit('update:translatedText', value)
}

const clearSourceText = () => {
  emit('clearSource')
}

const copyResult = () => {
  emit('copyResult')
}
</script>

<template>
  <div class="translation-area">
    <!-- 源文本 -->
    <div class="text-section">
      <div class="text-header">
        <span class="text-title">{{ computedSourceTitle }}</span>
        <v-btn 
          variant="text" 
          density="compact" 
          @click="clearSourceText"
          :disabled="!sourceText || sourceDisabled"
        >{{ t('textTranslate.clearButton') }}</v-btn>
      </div>
      <v-textarea
        :model-value="sourceText"
        @update:model-value="updateSourceText"
        :placeholder="computedSourcePlaceholder"
        :rows="rows"
        :auto-grow="autoGrow"
        hide-details
        variant="outlined"
        class="text-input"
        :disabled="sourceDisabled"
      ></v-textarea>
    </div>

    <!-- 翻译结果 -->
    <div class="text-section">
      <div class="text-header">
        <span class="text-title">{{ computedTargetTitle }}</span>
        <v-btn 
          variant="text" 
          density="compact" 
          @click="copyResult"
          :disabled="!translatedText"
        >{{ t('textTranslate.copyButton') }}</v-btn>
      </div>
      <v-textarea
        :model-value="translatedText"
        @update:model-value="updateTranslatedText"
        :placeholder="computedTargetPlaceholder"
        :rows="rows"
        :auto-grow="autoGrow"
        hide-details
        variant="outlined"
        class="text-input"
        :readonly="targetReadonly"
      ></v-textarea>
    </div>
  </div>
</template>

<style scoped>
.translation-area {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

.text-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.text-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-title {
  font-size: 16px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
}

.text-input {
  flex: 1;
  background: rgb(var(--v-theme-surface));
}
</style> 