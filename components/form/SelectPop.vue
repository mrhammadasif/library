<script setup lang="ts">
import type { SelectMixedOption } from 'naive-ui/es/select/src/interface'
import {
  get,
  isArray,
  isString,
} from 'lodash-es'

const props = withDefaults(defineProps<{
  label?: string
  name?: string
  labelOnLeft?: boolean
  outline?: boolean
  itemLabel?: string
  itemValue?: string
  modelValue?: string
  disabled?: boolean
  options: any[] | undefined
}>(), {
  itemLabel: 'label',
  disabled: false,
  outline: false,
  itemValue: 'value',
})

const emit = defineEmits(['update:modelValue'])

onMounted(async () => {
  await nextTick()
})

const itemsPreStage = computed(() => {
  if (isArray(props.options) && isString(props.options[0])) {
    return props.options.map((o) => {
      return {
        [props.itemLabel]: o,
        [props.itemValue]: o,
      }
    })
  }

  return props.options
})

const items = computed<SelectMixedOption[]>(() => {
  return itemsPreStage.value?.map((val) => {
    return {
      label: get(val, props.itemLabel),
      value: get(val, props.itemValue),
      disabled: val.disabled,
    }
  }) ?? []
})

const selectedLabel = computed(() => {
  return get(items.value?.find(l => l.value === props.modelValue), 'label') ?? `Select ${props.label}`
})
</script>

<template>
  <NFormItem
    :key="props.modelValue"
    label=""
    :label-placement="props.labelOnLeft ? 'left' : 'top'"
    :show-label="false"
    :show-feedback="false"
    :label-style="{ fontWeight: 'bold' }"
    :label-props="{
      'data-testid': `label-${props.name ?? 'unknown'}`,
    }"
    :path="props.name">
    <NPopselect
      trigger="click"
      filterable
      :disabled="props.disabled"
      :options="items"
      :value="props.modelValue"
      @update:value="emit('update:modelValue', $event)">
      <NButton
        type="primary"
        block
        :ghost="props.outline"
        class="w-full dark:text-white">
        {{ selectedLabel }}
        <i-carbon-chevron-down ml-2 />
      </NButton>
    </NPopselect>
  </NFormItem>
</template>
