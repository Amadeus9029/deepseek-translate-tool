<script setup lang="ts">
defineProps({
  label: {
    type: String,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  color: {
    type: String,
    default: 'primary'
  },
  size: {
    type: String,
    default: 'large'
  },
  loadingText: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['click'])

const handleClick = () => {
  emit('click')
}
</script>

<template>
  <v-btn 
    :color="color" 
    :size="size" 
    class="action-btn" 
    @click="handleClick"
    :loading="loading"
    :disabled="disabled"
    :prepend-icon="icon"
  >
    {{ loading && loadingText ? loadingText : label }}
  </v-btn>
</template>

<style scoped>
.action-btn {
  min-width: 160px;
  text-transform: capitalize;
}
</style> 