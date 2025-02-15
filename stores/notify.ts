import {
  orderBy,
  uniqBy,
} from 'lodash-es'
import {
  acceptHMRUpdate,
  defineStore,
} from 'pinia'

export interface NotificationOptions {
  id: string | number
  message: string
  title: string
  type: 'success' | 'error'
  at: number
  timeout: number
  shown: boolean
}
export class AppNotification implements NotificationOptions {
  message: NotificationOptions['message'] = ''
  title: NotificationOptions['title'] = ''
  type: NotificationOptions['type'] = 'error'
  at: NotificationOptions['at'] = Date.now()
  timeout: NotificationOptions['timeout'] = 3000
  id: NotificationOptions['id'] = Date.now()
  shown: NotificationOptions['shown'] = false

  static from(msg: string, title?: string, type: AppNotification['type'] = 'success', opts?: Partial<NotificationOptions>) {
    const notif = new AppNotification()
    notif.title = title ?? ''
    notif.id = Date.now()
    notif.message = msg
    notif.shown = false
    notif.type = type
    notif.at = opts?.at ? opts.at : Date.now()
    notif.timeout = opts?.timeout ? opts.timeout : 3000
    notif.id = opts?.id ? opts.id : Date.now()
    return notif
  }
}
export const useNotificationsStore = defineStore('notifications', () => {
  const _notifications = ref<AppNotification[]>([])

  const notifications = computed(() => {
    const ns = uniqBy(_notifications.value, 'id')

    return orderBy(ns, a => new Date(a.at), 'desc')
  })

  const dismiss = (id: AppNotification['id']) => {
    _notifications.value.splice(_notifications.value.findIndex(n => n.id === id), 1)
  }

  const dismissAll = () => {
    _notifications.value = []
  }

  function success(msgToShow: string, title?: string, opts?: Partial<NotificationOptions>) {
    if (opts?.id) {
      dismiss(opts.id) // remove any previous notification with the same id
    }

    _notifications.value.push(AppNotification.from(msgToShow, title, 'success', opts))
  }

  function error(msgToShow: string | Error | any, title?: string, opts?: Partial<NotificationOptions>) {
    if (opts?.id) {
      dismiss(opts.id) // remove any previous notification with the same id
    }

    const pE = parseError(msgToShow, title)
    _notifications.value.push(AppNotification.from(pE[0], pE[1], 'error', opts))
  }

  return {
    notifications,
    dismiss,
    dismissAll,
    success,
    error,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useNotificationsStore, import.meta.hot))
}
