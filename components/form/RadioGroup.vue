<script setup lang="ts">
import {
  isArray,
  isString,
} from 'lodash-es'

const props = withDefaults(defineProps<{
  label?: string
  name?: string
  labelOnLeft?: boolean
  hideFeedback?: boolean
  disabled?: boolean
  itemLabel?: string
  itemValue?: string
  modelValue?: string
  options?: any[]
  inline?: boolean
}>(), {
  itemLabel: 'label',
  itemValue: 'value',
  disabled: false,
  inline: false,
  hideFeedback: false,
  options: () => [],
})

const emit = defineEmits(['update:modelValue'])
const attrs = useAttrs()

const items = computed(() => {
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
</script>

<template>
  <NFormItem
    class="w-full"
    :show-feedback="!props.hideFeedback"
    :show-label="!!props.label"
    :label="props.label"
    :label-placement="props.labelOnLeft ? 'left' : 'top'"
    :label-style="{ fontWeight: 'bold' }"
    :path="props.name">
    <div :class="attrs.class ?? ''">
      <NRadioGroup
        :name="props.name"
        :value="props.modelValue"
        @update:value="emit('update:modelValue', $event)">
        <template
          v-for="(option, index) in items"
          :key="index">
          <div :class="props.inline && 'inline-block'">
            <NRadio
              :disabled="props.disabled"
              :value="option[props.itemValue]"
              :label="option[props.itemLabel]">
              {{ option.label }}
            </NRadio>
          </div>
        </template>
      </NRadioGroup>
    </div>
  </NFormItem>
</template>
