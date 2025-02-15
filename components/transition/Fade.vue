<script lang="ts" setup>
const props = withDefaults(defineProps<{
  group?: boolean
  speed?: number
}>(), {
  speed: 400,
  group: false,
})

const attrs = useAttrs()
const durationEnter = computed(() => props.speed)
const durationLeave = computed(() => props.speed - 100)
</script>

<template>
  <TransitionGroup
    v-if="props.group"
    enter-active-class="transition fade-duration-in ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition fade-duration-out ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
    mode="out-in"
    v-bind="attrs">
    <slot />
  </TransitionGroup>
  <Transition
    v-else
    enter-active-class="transition fade-duration-in ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition fade-duration-out ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
    mode="out-in"
    v-bind="attrs">
    <slot />
  </Transition>
</template>

<style>
.fade-duration-in {
  transition-duration: v-bind(durationEnter);
}
.fade-duration-out {
  transition-duration: v-bind(durationLeave);
}
</style>
