<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string
  name?: string
  readonly?: boolean
  disabled?: boolean
  labelOnLeft?: boolean
  shortcuts?: Record<string, [number, number] | (() => [number, number])>
  modelValue?: [number, number] | undefined
  disabledDates?: (date: number) => boolean
  clearable?: boolean | undefined
  hideFeedback?: boolean
}>(), {
  hideFeedback: false,
  readonly: false,
  disabled: false,
})

const emit = defineEmits(['update:modelValue'])
const attrs = useAttrs()
</script>

<template>
  <NFormItem
    class="w-full"
    :show-feedback="!props.hideFeedback"
    :label="props.label"
    :label-placement="props.labelOnLeft ? 'left' : 'top'"
    :label-style="{ fontWeight: 'bold' }"
    :path="props.name">
    <NDatePicker
      :is-date-disabled="props.disabledDates"
      :disabled="props.disabled"
      class="w-full"
      v-bind="attrs"
      :shortcuts="props.shortcuts"
      :readonly="readonly"
      placeholder=""
      :clearable="props.clearable"
      type="daterange"
      :value="props.modelValue"
      @update:value="emit('update:modelValue', $event)" />
  </NFormItem>
</template>
