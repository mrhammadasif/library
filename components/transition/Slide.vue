<script lang="ts" setup>
const props = withDefaults(defineProps<{
  group?: boolean
}>(), { group: false })

const attrs = useAttrs()
</script>

<template>
  <TransitionGroup
    v-if="props.group"
    enter-active-class="transition duration-400 ease-out"
    enter-from-class="translate-y-4 opacity-0"
    enter-to-class="translate-y-0 opacity-200"
    leave-active-class="transition duration-300 ease-in"
    leave-from-class="translate-y-0 opacity-200"
    leave-to-class="translate-y-4 opacity-0"
    v-bind="attrs">
    <slot />
  </TransitionGroup>
  <Transition
    v-else
    enter-active-class="transition duration-400 ease-out"
    enter-from-class="translate-y-4 opacity-0"
    enter-to-class="translate-y-0 opacity-200"
    leave-active-class="transition duration-300 ease-in"
    leave-from-class="translate-y-4 opacity-200"
    leave-to-class="translate-y-4 opacity-0"
    v-bind="attrs">
    <slot />
  </Transition>
</template>
