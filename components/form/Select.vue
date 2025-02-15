<script setup lang="ts">
import type { FormItemInst } from 'naive-ui'
import type { SelectMixedOption } from 'naive-ui/es/select/src/interface'
import {
  isArray,
  isString,
} from 'lodash-es'

const props = withDefaults(defineProps<{
  label?: string
  name?: string
  feedback?: string
  itemLabel?: string
  itemValue?: string
  disabled?: boolean
  modelValue?: string | string[] | number | number[] | null
  multiple?: boolean
  labelOnLeft?: boolean
  autocomplete?: string
  hideFeedback?: boolean
  options?: any[] | undefined
  validationStatus?: 'error' | 'success' | 'warning' | undefined
}>(), {
  multiple: false,
  labelOnLeft: true,
  feedback: '',
  hideFeedback: false,
  itemLabel: 'label',
  itemValue: 'value',
  options: () => [],
})

const emit = defineEmits(['update:modelValue'])
// const attrs = useAttrs()

// onMounted(async () => {
//   await nextTick()
// })
const itemsPreStage = computed(() => {
  if (isArray(props.options) && isString(props.options[0])) {
    return props.options.map((o) => {
      return {
        [props.itemLabel]: o,
        [props.itemValue]: o,
      }
    })
  }

  return props.options ?? []
})

const items = computed<SelectMixedOption[]>(() => {
  return itemsPreStage.value?.map((val) => {
    return {
      label: get(val, props.itemLabel),
      value: get(val, props.itemValue),
      ...val,
    }
  }) ?? []
})

const formItemRef = ref<FormItemInst>()
const attrs = useAttrs()

watch(() => props.modelValue, () => {
  formItemRef.value?.validate()
})
</script>

<template>
  <div>
    <NFormItem
      ref="formItemRef"
      :key="props.label"
      :show-feedback="!props.hideFeedback"
      :label="props.label"
      :show-label="!!props.label"
      :label-placement="props.labelOnLeft ? 'left' : 'top'"
      :label-style="{ fontWeight: 'bold' }"
      :label-props="{
        'data-testid': `label-${props.name ?? 'unknown'}`,
      }"
      :validation-status="props.validationStatus"
      :path="props.name">
      <NSelect
        v-bind="attrs"
        :input-props="{
          'role': 'listbox',
          'aria-label': props.label || props.name,
          'autocomplete': props.autocomplete,
          'data-testid': `select-${props.name ?? 'unknown'}`,
        }"
        aria-required="true"
        :aria-label="props.label || props.name"
        filterable
        :disabled="props.disabled"
        :options="items"
        :multiple="props.multiple"
        :value="props.modelValue"
        @update:value="emit('update:modelValue', $event)">
        <template
          v-for="(_, slotName) in ($slots ?? [])"
          #[String(slotName)]="slotData"
          :key="slotName">
          <slot
            :name="slotName"
            v-bind="slotData || {}" />
        </template>
      </NSelect>
      <template
        v-if="props.feedback"
        #feedback>
        <div class="grid-area-[feedback] mb-3 block w-full space-y-2">
          <slot name="feedback">
            {{ props.feedback }}
          </slot>
        </div>
      </template>
    </NFormItem>
  </div>
</template>
