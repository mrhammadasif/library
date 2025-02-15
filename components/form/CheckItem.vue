<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string
  name?: string
  disabled?: boolean
  modelValue?: boolean
}>(), {
  disabled: false,
  modelValue: false,
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="">
    <NCheckbox
      value="true"
      :checked="props.modelValue"
      :checked-value="true"
      :unchecked-value="false"
      :label="props.label"
      @update:checked="emit('update:modelValue', $event)" />
  </div>
</template>
