<script setup lang="ts">
import {
  isDate,
  isNumber,
  isString,
} from 'lodash-es'

const props = withDefaults(defineProps<{
  label?: string
  name?: string
  format?: string
  readonly?: boolean
  disabled?: boolean
  shortcuts?: Record<string, number | (() => number)>
  modelValue?: Date | number | string | null | undefined
  labelOnLeft?: boolean
  disabledDates?: (date: number) => boolean
  clearable?: boolean | undefined
  placeholder?: string
  hideFeedback?: boolean
  actions?: ('clear' | 'confirm' | 'now')[]
}>(), {
  actions: () => ['clear', 'now'],
  hideFeedback: false,
  readonly: false,
  format: 'dd-MM-yyyy',
  disabled: false,
  labelOnLeft: true,
  placeholder: '',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: Date | null | undefined): void
}>()

const localValue = ref()

watchImmediate(() => props.modelValue, () => {
  if (!props.modelValue) {
    localValue.value = null
  }

  if (props.modelValue && isString(props.modelValue)) {
    localValue.value = parseDate(props.modelValue).toSeconds() * 1000
  }

  if (props.modelValue && isDate(props.modelValue)) {
    localValue.value = parseDate(props.modelValue).toSeconds() * 1000
  }

  if (props.modelValue && isNumber(props.modelValue)) {
    localValue.value = props.modelValue
  }
})

function updateDate(date?: number) {
  localValue.value = date
  emit('update:modelValue', date ? parseDate(date).toJSDate() : null)
}

const attrs = useAttrs()
</script>

<template>
  <NFormItem
    class="w-full"
    :show-feedback="!props.hideFeedback"
    :label="props.label"
    :show-label="!!props.label"
    :label-placement="props.labelOnLeft ? 'left' : 'top'"
    :label-style="{ fontWeight: 'bold' }"
    :path="props.name">
    <NDatePicker
      role="dialog"
      :is-date-disabled="props.disabledDates"
      :disabled="props.disabled"
      class="w-full"
      :format="props.format"
      v-bind="attrs"
      :actions="props.actions"
      :shortcuts="props.shortcuts"
      :readonly="readonly"
      :placeholder="props.placeholder"
      :clearable="props.clearable"
      :value="localValue"
      @update:value="updateDate($event)" />
  </NFormItem>
</template>
