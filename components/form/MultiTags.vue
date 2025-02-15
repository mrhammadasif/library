<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string
  name?: string
  readonly?: boolean
  disabled?: boolean
  labelOnLeft?: boolean
  max?: number
  modelValue?: string[]
  clearable?: boolean | undefined
  hideFeedback?: boolean
}>(), {
  hideFeedback: false,
  labelOnLeft: true,
  readonly: false,
  disabled: false,
})

const emit = defineEmits(['update:modelValue'])
const attrs = useAttrs()

const maxProp = computed(() => {
  if (props.readonly) {
    return +(props.modelValue?.length ?? 1) - 1
  }

  return props.max
})

const clearableProp = computed(() => {
  if (props.readonly) {
    return false
  }

  return props.clearable
})
</script>

<template>
  <NFormItem
    class="w-full"
    :show-feedback="!props.hideFeedback"
    :label="props.label"
    :label-placement="props.labelOnLeft ? 'left' : 'top'"
    :show-label="!!props.label"
    :label-style="{ fontWeight: 'bold' }"
    :path="props.name">
    <NDynamicTags
      v-bind="attrs"
      :readonly="readonly"
      :disabled="props.disabled"
      :closable="clearableProp"
      :max="maxProp"
      placeholder=""
      :clearable="props.clearable"
      :value="props.modelValue"
      @update:value="emit('update:modelValue', $event)" />
  </NFormItem>
</template>
