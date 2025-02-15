<script setup lang="ts">
import { useNotificationsStore } from '~/stores/notify'

const props = defineProps<{
  label?: string
  name?: string
  type?: 'text' | 'password' | 'email' | 'textarea'
  readonly?: boolean
  feedback?: string
  copy?: boolean
  disabled?: boolean
  modelValue?: string | [string, string] | null
  clearable?: boolean | undefined
  labelOnLeft?: boolean
  hideFeedback?: boolean
  autocomplete?: string
  placeholder?: string
}>()

const emit = defineEmits(['update:modelValue'])
const attrs = useAttrs()
const notify = useNotificationsStore()

function onCopy() {
  navigator.clipboard.writeText(String(props.modelValue))
  notify.success('Copied to clipboard')
}

function onUpdate($event: any) {
  emit('update:modelValue', $event)
}
</script>

<template>
  <NFormItem
    class="block w-full"
    :show-feedback="!hideFeedback"
    :label="props.label"
    :show-label="!!props.label"
    :label-placement="props.labelOnLeft ? 'left' : 'top'"
    :label-style="{ fontWeight: 'bold' }"
    :path="props.name">
    <NInput
      v-bind="attrs"
      :input-props="{
        autocomplete: props.autocomplete,
        type: props.type === 'email' ? 'email' : props.type,
      }"
      :readonly="readonly"
      :disabled="props.disabled"
      :placeholder="!!props.placeholder ? props.placeholder : ''"
      :clearable="props.clearable"
      :type="props.type === 'email' ? 'text' : props.type"
      :value="props.modelValue"
      @update:value="onUpdate">
      <template
        v-if="props.copy"
        #suffix>
        <span
          v-tooltip="'Copy to Clipboard'"
          class="inline-block pointer rounded p-1 leading-0 hover:bg-gray-200">
          <i-carbon-copy
            class="inline h6 w4 color-inherit"
            @click="onCopy" />
        </span>
      </template>
      <template
        v-for="(_, slotName) in ($slots ?? [])"
        #[String(slotName)]="slotData"
        :key="slotName">
        <slot
          :name="slotName"
          v-bind="slotData || {}" />
      </template>
    </NInput>
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
</template>
