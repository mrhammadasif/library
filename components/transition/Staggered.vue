<script setup lang="ts">
const props = withDefaults(defineProps<{
  items?: any[]
  /** delay in milliseconds */
  delay?: number
  /** speed in milliseconds */
  speed?: number
  tag?: string
}>(), {
  tag: 'div',
  delay: 300,
  speed: 1000,
})

const showItems = ref(false)

onMounted(() => {
  nextTick(() => {
    showItems.value = true
  })
})

onUnmounted(() => {
  showItems.value = false
})

const delayInSeconds = computed(() => {
  return `${props.delay <= 0 ? 0 : props.delay / 1000.0}s`
})

const speedInSeconds = computed(() => {
  return `${props.delay <= 0 ? 0 : props.speed / 1000.0}s`
})
</script>

<template>
  <!-- eslint-disable vue/no-use-v-if-with-v-for -->
  <transition-group
    :tag="props.tag"
    name="slide-in"
    :style="{ '--total': props.items?.length }">
    <div
      v-for="(l, i) in props.items"
      v-if="showItems"
      :key="i"
      :style="{ '--i': i }">
      <slot
        :item="l ?? undefined"
        :index="i">
        Slot Item {{ i }}
      </slot>
    </div>
  </transition-group>
</template>

<style lang="scss">
.slide-in {

  &-move {
    transition: opacity v-bind(delayInSeconds) linear, transform v-bind(speedInSeconds) ease-in-out;
  }

  &-leave-active {
    transition: opacity v-bind(delayInSeconds) linear, transform v-bind(speedInSeconds) cubic-bezier(.5,0,.7,.4); //cubic-bezier(.7,0,.7,1);
    transition-delay: calc( v-bind(delayInSeconds) * (var(--total) - var(--i)) );
  }

  &-enter-active {
    transition: opacity v-bind(delayInSeconds) linear, transform v-bind(speedInSeconds) cubic-bezier(.2,.5,.1,1);
    transition-delay: calc( v-bind(delayInSeconds) * 0.1 * var(--i) );
  }

  &-enter-from,
  &-leave-to {
    opacity: 0;
  }
  $from: 1em;
  &-enter-from { transform: translateY(-$from); }
  &-leave-to { transform: translateY($from); }

}
</style>
