<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string
  feedback?: string
  name?: string
  type?: string
  readonly?: boolean
  disabled?: boolean
  modelValue?: number
  labelOnLeft?: boolean
  min?: number
  max?: number
  clearable?: boolean
  hideFeedback?: boolean
  formatNumber?: boolean
}>(), {
  formatNumber: true,
  hideFeedback: false,
  labelOnLeft: true,
  feedback: '',
  min: Number.MIN_SAFE_INTEGER,
  max: Number.MAX_SAFE_INTEGER,
  readonly: false,
  disabled: false,
})

const emit = defineEmits(['update:modelValue'])

function parse(input: string) {
  const nums = input.replace(/,/g, '').trim()

  if (/^[\d\-]+(\.(\d+)?)?$/.test(nums)) {
    return Number(nums)
  }

  return nums === '' ? null : Number.NaN
}

function format(value: number | null) {
  if (value === null) {
    return ''
  }

  return value.toLocaleString('en-US')
}

const attrs = useAttrs()
</script>

<template>
  <NFormItem
    :show-feedback="!props.hideFeedback"
    :label="props.label"
    :show-label="!!props.label"
    :label-placement="props.labelOnLeft ? 'left' : 'top'"
    :label-style="{ fontWeight: 'bold' }"
    :path="props.name">
    <NInputNumber
      :parse="formatNumber ? parse : undefined"
      :format="formatNumber ? format : undefined"
      class="w-full"
      v-bind="attrs"
      :readonly="readonly"
      :disabled="props.disabled"
      placeholder=""
      :min="props.min"
      :max="props.max"
      :clearable="props.clearable"
      :value="props.modelValue"
      @update:value="emit('update:modelValue', $event)" />
    <template
      v-if="props.feedback"
      #feedback>
      <div class="grid-area-[feedback] mb-3 block w-full space-y-2">
        <slot name="feedback">
          {{ props.feedback }}
        </slot>
      </div>
    </template>
    <template
      v-for="(_, slotName) in ($slots ?? [])"
      #[String(slotName)]="slotData"
      :key="slotName">
      <slot
        :name="slotName"
        v-bind="slotData || {}" />
    </template>
  </NFormItem>
</template>
