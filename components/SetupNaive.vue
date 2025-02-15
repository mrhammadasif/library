<script lang="ts" setup>
import { NaiveConfig } from '#components'
</script>

<template>
  <NaiveConfig>
    <NMessageProvider>
      <NNotificationProvider>
        <NLoadingBarProvider>
          <NDialogProvider>
            <slot />
          </NDialogProvider>
        </NLoadingBarProvider>
      </NNotificationProvider>
    </NMessageProvider>
  </NaiveConfig>
</template>

<style>

</style>
