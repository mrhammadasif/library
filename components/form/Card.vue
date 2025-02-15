<script lang="ts" setup>
import { NCard } from 'naive-ui'

withDefaults(defineProps<{
  title: string
  subtitle?: string
}>(), { subtitle: '' })
</script>

<template>
  <NCard
    class="p4 mb-4">
    <div class="flex flex-col items-start md:flex-row">
      <div class="mb-4 w-full bg-gray-100 pa-3 md:mb-0 md:w-1/4 md:bg-transparent md:pa-0">
        <h1 class="font-bold text-primary">
          {{ title }}
        </h1>
        <p class="text-sm text-gray-500">
          {{ subtitle }}
        </p>
        <slot name="below-title" />
      </div>
      <div class="w-full md:flex-1">
        <slot />
      </div>
    </div>
    <template
      #footer>
      <div class="flex justify-end">
        <slot name="footer" />
      </div>
    </template>
  </NCard>
</template>
