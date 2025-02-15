<script setup lang="ts">
import type { NotificationOptions } from '~/stores/notify'
import { take } from 'lodash-es'
import { useNotificationsStore } from '~/stores/notify'

const notificationStore = useNotificationsStore()
const showNotificationsDialog = ref(false)

function dismissAll() {
  notificationStore.dismissAll()
}

function doClose(notification: NotificationOptions) {
  return setTimeout(() => {
    notification.shown = true
  }, notification.timeout ?? 3000)
}

function dismiss(notification: NotificationOptions) {
  return setTimeout(() => {
    notification.shown = true
  }, 10)
}

const creamOfNotifications = computed(() => {
  return take(notificationStore.notifications.filter(a => !a.shown) || [], 3)
})

const bellIconRef = ref<any>(null)

function showPanel() {
  showNotificationsDialog.value = true
  notificationStore.notifications.forEach(notification => notification.shown = true)
}

watchArray(() => notificationStore.notifications, async (notifications, __, added) => {
  if (added.length > 0) {
    added.forEach(notification => doClose(notification))
    bellIconRef.value?.$el.classList?.remove('animate-flash')
    await waitFor(100)
    bellIconRef.value?.$el.classList?.add('animate-flash')
  }
})
</script>

<template>
  <div>
    <div
      v-tooltip="'Show Notifications'"
      class="toolbar-icon"
      @click="showPanel">
      <TransitionSlide>
        <NBadge :value="notificationStore.notifications.length">
          <i-carbon-notification
            ref="bellIconRef"
            class="h6 w6 text-white"
            :class="{ 'animate-duration-0.5s animate-fade-in animate-running': notificationStore.notifications.length > 0 }"
            h6
            w6 />
        </NBadge>
      </TransitionSlide>
    </div>
    <Teleport to="body">
      <div
        class="notifications-panel-gradient-base pointer-events-none fixed right-0 top-64px z999999999 hfull w-400px text-text"
        :class="{ 'notifications-panel-gradient': creamOfNotifications.length > 0 }">
        <div class="pa2">
          <TransitionSlideLeft group>
            <NotificationItem
              v-for="notification in creamOfNotifications"
              :key="notification.id + notification.message"
              :notification="notification"
              @dismiss="dismiss(notification)"
              @click="showPanel" />
          </TransitionSlideLeft>
        </div>
      </div>
    </Teleport>
    <!-- show -->
    <NDrawer
      v-model:show="showNotificationsDialog"
      mask-closable
      :width="400">
      <NDrawerContent :native-scrollbar="false">
        <div class="min-h-screen bg-bg pa-4 dark:bg-dark">
          <div class="mb-4 flex items-start justify-between">
            <div>
              <h3 class="text-5 font-bold">
                Notifications
              </h3>
              <a
                v-if="notificationStore.notifications.length > 0"
                href="javascript://"
                class="text-3 text-blue underline outline-none ring-0"
                @click="dismissAll">
                Dismiss All
              </a>
            </div>
            <Btn
              text
              icon
              @click="showNotificationsDialog = false">
              <i-carbon-close square-6 />
            </Btn>
          </div>
          <TransitionGsap group>
            <template v-if="notificationStore.notifications.length <= 0">
              <div class="flex flex-col items-center justify-center pt-12 space-y-5">
                <i-carbon-notification-off class="h32 w32" />
                <h3 class="mt-5 text-5 font-bold">
                  No Notifications Found
                </h3>
                <p class="text-center">
                  You currently don't have any notifications. We'll notify you when something new arrives!
                </p>
                <Btn @click="showNotificationsDialog = false">
                  Close Panel
                </Btn>
              </div>
            </template>
            <NotificationItem
              v-for="notification in notificationStore.notifications"
              :key="notification.id + notification.message"
              :notification="notification"
              @dismiss="notificationStore.dismiss" />
          </TransitionGsap>
        </div>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>

<style scoped>
.notifications-panel-gradient-base {
  z-index: 9999 !important;
  background-size: 200% 100%;
  background-position: 0 0;
  background-repeat: no-repeat;
  transition: background-position 0.3s ease-in-out;
  background-image: radial-gradient(circle at top right,
      rgba(#414141, 0.8),
      rgba(#999, 0.5) 15%,
      rgba(0, 0, 0, 0) 30%);

  &.notifications-panel-gradient {
    background-position: 80% 0;
  }
}
.dark {
  .notifications-panel-gradient-base {
    background-image: radial-gradient(circle at top right,
        rgba(#fff, 0.3),
        rgba(#fff, 0.05) 20%,
        rgba(#fff, 0) 30%);
  }
}
</style>
