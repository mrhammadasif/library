<script lang="ts" setup>
import type { NotificationOptions } from '~/stores/notify'

const props = withDefaults(defineProps<{
  notification: NotificationOptions
  onDismiss?: ($event: any) => void
}>(), {})

const emit = defineEmits<{
  (e: 'dismiss', id: any): void
}>()
</script>

<template>
  <div
    class="z9999999 mb-2 items-center border border-primary-light border-opacity-40 rounded-lg bg-white p2 shadow-lg dark:border-gray-500 dark:bg-gray-700 dark:text-white">
    <div class="w-full flex items-center justify-between">
      <div class="flex items-center">
        <i-carbon-information-filled
          v-if="props.notification.type === 'success'"
          color="info" />
        <i-carbon-close-filled
          v-else
          color="error" />
        <div class="ml-1 text-3.2 color-inherit font-bold leading-4">
          {{ props.notification.title || props.notification.message || "" }}
        </div>
      </div>
      <div
        class="pointer-events-auto pointer"
        @click.stop="emit('dismiss', props.notification.id)">
        <i-carbon-close

          h6
          w6
          opacity-40 />
      </div>
    </div>
    <!-- <div>
      <pre>{{ attrs }}</pre>
    </div> -->
    <p
      v-if="!!props.notification.title"
      class="overflow-wrap text-3 color-inherit opacity-80">
      {{ props.notification.message }}
    </p>
    <div class="flex items-center text-3 color-inherit">
      <i-carbon-time

        mr-1
        h3
        w3
        opacity-30 />
      <span opacity-50>{{ timeAgo(props.notification.at) }}</span>
    </div>
  </div>
</template>
