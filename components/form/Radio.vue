<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string
  name?: string
  disabled?: boolean
  labelOnLeft?: boolean
  modelValue?: string | number | boolean
  value?: string | number | boolean
}>(), {
  disabled: false,
  modelValue: false,
  value: 'on',
})

const emit = defineEmits(['update:modelValue'])
const attrs = useAttrs()
</script>

<template>
  <NFormItem
    :show-feedback="false"
    :show-label="false"
    :label="props.label"
    :label-placement="props.labelOnLeft ? 'left' : 'top'"
    :label-style="{ fontWeight: 'bold' }"
    :path="props.name">
    <NRadio
      :disabled="props.disabled"
      v-bind="attrs"
      :value="props.value"
      :checked="props.modelValue === props.value"
      @update:checked="emit('update:modelValue', props.value)">
      <slot />
    </NRadio>
  </NFormItem>
</template>
