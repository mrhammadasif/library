<template>
  <NConfigProvider inline-theme-disabled>
    <NMessageProvider>
      <NNotificationProvider>
        <NLoadingBarProvider>
          <NDialogProvider>
            <slot />
          </NDialogProvider>
        </NLoadingBarProvider>
      </NNotificationProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>
