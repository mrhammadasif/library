<script lang="ts" setup>
import { isUndefined } from 'lodash-es'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  promise?: Promise<any>
  show?: boolean
  opaque?: boolean
}>(), { })

const showLoading = computedAsync(async () => {
  if (!isUndefined(props.show)) {
    return props.show
  }

  if (isUndefined(props.promise)) {
    return false
  }

  try {
    await props.promise
  }
  catch (e) {
    console.error(e)
  }

  return true
})

const attrs = useAttrs()
</script>

<template>
  <div class="relative">
    <div :class="showLoading && 'blur-4 max-h-[80vh] overflow-hidden'">
      <slot />
    </div>
    <TransitionFade :speed="800">
      <div
        v-if="showLoading"
        v-bind="attrs"
        :class="{
          'bg-white dark:bg-dark dark:bg-opacity-100 bg-opacity-100': opaque,
          'bg-white dark:bg-black dark:bg-opacity-90 bg-opacity-90': !opaque,
        }"
        class="absolute inset-0 flex-center">
        <NSpin />
      </div>
    </TransitionFade>
  </div>
</template>
