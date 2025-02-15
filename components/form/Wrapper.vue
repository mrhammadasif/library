<script setup lang="ts">
import type {
  FormInst,
  FormRules,
} from 'naive-ui'
import type {
  FormValidateCallback,
  ShouldRuleBeApplied,
} from 'naive-ui/es/form/src/interface'
import { useMessage } from 'naive-ui'

const props = defineProps<{
  model: Record<string, any>
  rules: FormRules
}>()

const emit = defineEmits<{
  (e: 'success'): void
  (e: 'error', error: any): void
}>()

const formRef = ref<FormInst | undefined>()
const notify = useMessage()

// const isValid = computedAsync(async () => {
//   return formRef.value && formRef.value?.validate().then(o => true).catch(e => false)
// }, false)

function doSubmit() {
  formRef.value?.validate().then(() => {
    emit('success')
  }).catch((e) => {
    notify.error('Fix the highlighted issues in Form')
    emit('error', e)
  })
}

function validate(): Promise<{
  message?: string
  fieldValue?: any
  field?: string
} | void> {
  return new Promise((resolve, reject) => {
    formRef.value?.validate((errors) => {
      if (errors) {
        reject(errors)
      }
      else {
        resolve()
      }
    })
  })
}

function validateOrig(callback?: FormValidateCallback, shouldRuleBeApplied?: ShouldRuleBeApplied) {
  return formRef.value?.validate(callback, shouldRuleBeApplied) ?? Promise.resolve()
}

function resetForm() {
  formRef.value?.restoreValidation()
}

defineExpose({
  submit: doSubmit,
  validate,
  validateOrig,
  resetForm,
})
</script>

<template>
  <NForm
    ref="formRef"
    :autocorrect="false"
    :model="props.model"
    :rules="props.rules">
    <slot :submit="doSubmit" />
  </NForm>
</template>
