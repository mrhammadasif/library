<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string
  name: string
  feedback?: string
  disabled?: boolean
  hideFeedback?: boolean
  labelOnLeft?: boolean
  modelValue?: boolean
}>(), {
  disabled: false,
  feedback: '',
  hideFeedback: false,
  modelValue: false,
})

const emit = defineEmits(['update:modelValue'])
const attrs = useAttrs()
</script>

<template>
  <NFormItem
    class="form-item-switch"
    :show-feedback="!props.hideFeedback"
    :label="props.label"
    :label-placement="props.labelOnLeft ? 'left' : 'top'"
    :show-label="!!props.label"
    :label-style="{ fontWeight: 'bold' }"
    :label-props="{
      'data-testid': `label-${props.name}`,
    }"
    :path="props.name">
    <NSwitch
      :disabled="props.disabled"
      v-bind="attrs"
      :data-testid="`switch-${props.name}-${props.modelValue}`"
      :value="props.modelValue"
      :class="props.labelOnLeft ? '' : 'no'"
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
  </NFormItem>
</template>

<style>
.n-form-item .form-item-switch,
.n-form-item.form-item-switch {
  margin-bottom: 0 !important;
}
.n-form-item--left-labelled .n-switch {
  height: 34px !important;
}
</style>
