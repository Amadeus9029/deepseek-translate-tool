<script setup lang="ts">
import { type LanguageOption } from '../../constants/languages'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  sourceLanguage: {
    type: Object as () => LanguageOption | null,
    default: null
  },
  targetLanguage: {
    type: Object as () => LanguageOption | null,
    default: null
  },
  availableLanguages: {
    type: Array as () => LanguageOption[],
    required: true
  },
  disabled: {
    type: Boolean,
    default: false
  },
  showSwapButton: {
    type: Boolean,
    default: true
  }
})

const { t } = useI18n()
const emit = defineEmits(['update:sourceLanguage', 'update:targetLanguage', 'swap'])

const updateSourceLanguage = (value: LanguageOption) => {
  emit('update:sourceLanguage', value)
}

const updateTargetLanguage = (value: LanguageOption) => {
  emit('update:targetLanguage', value)
}

const swapLanguages = () => {
  emit('swap')
}
</script>

<template>
  <div class="source-language">
    <v-autocomplete
      :model-value="sourceLanguage"
      @update:model-value="updateSourceLanguage"
      :items="availableLanguages"
      :label="t('common.sourceLanguage')"
      hide-details
      density="compact"
      variant="outlined"
      class="language-select"
      item-title="text"
      item-value="value"
      return-object
      :menu-props="{ maxHeight: 300 }"
      :disabled="disabled"
    ></v-autocomplete>
    <v-btn 
      v-if="showSwapButton"
      icon="mdi-swap-horizontal" 
      variant="text" 
      @click="swapLanguages"
      class="swap-btn"
      :disabled="disabled"
      :title="t('common.swap')"
    ></v-btn>
    <v-autocomplete
      :model-value="targetLanguage"
      @update:model-value="updateTargetLanguage"
      :items="availableLanguages"
      :label="t('common.targetLanguage')"
      hide-details
      density="compact"
      variant="outlined"
      class="language-select"
      item-title="text"
      item-value="value"
      return-object
      :menu-props="{ maxHeight: 300 }"
      :disabled="disabled"
    ></v-autocomplete>
  </div>
</template>

<style scoped>
.source-language {
  display: flex;
  align-items: center;
  gap: 16px;
}

.language-select {
  width: 200px;
}

.swap-btn {
  margin: 0 8px;
}
</style> 