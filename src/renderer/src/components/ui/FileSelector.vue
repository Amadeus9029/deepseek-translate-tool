<script setup lang="ts">
const props = defineProps({
  filePath: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    default: '文件'
  },
  placeholder: {
    type: String,
    default: '请选择文件'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  buttonText: {
    type: String,
    default: '选择文件'
  },
  filters: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['select'])

const selectFile = () => {
  emit('select', props.filters)
}
</script>

<template>
  <div class="file-input-row">
    <div class="label">{{ label }}:</div>
    <v-text-field
      :model-value="filePath"
      hide-details
      density="compact"
      variant="outlined"
      readonly
      :placeholder="placeholder"
      class="file-input"
    ></v-text-field>
    <v-btn 
      color="primary" 
      class="select-btn" 
      @click="selectFile"
      :disabled="disabled"
    >
      {{ buttonText }}
    </v-btn>
  </div>
</template>

<style scoped>
.file-input-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.label {
  min-width: 80px;
  color: rgb(var(--v-theme-on-surface));
}

.file-input {
  flex: 1;
}

.select-btn {
  min-width: 100px;
}
</style> 