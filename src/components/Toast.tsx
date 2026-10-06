import type { ReactNode } from 'react'
import * as Haptics from 'expo-haptics'
import { createContext, use, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface IToast {
  emoji: string
  text: string
}

const ToastContext = createContext<((text: string, emoji?: string) => void) | null>(null)

/** Big, friendly confirmation at the top of the screen ("📚 Added to Shelf 2"), with a success buzz. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  const [toast, setToast] = useState<IToast | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function show(text: string, emoji = '✅') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    setToast({ text, emoji })
    if (timer.current) {
      clearTimeout(timer.current)
    }
    timer.current = setTimeout(() => setToast(null), 2600)
  }

  return (
    <ToastContext value={show}>
      {children}
      {toast && (
        <View pointerEvents="none" className="absolute left-4 right-4 items-center" style={{ top: insets.top + 8 }}>
          <View
            accessibilityLiveRegion="polite"
            className="flex-row items-center gap-3 rounded-2xl bg-walnut px-5 py-4"
            style={{ shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 10 }}
          >
            <Text className="text-2xl">{toast.emoji}</Text>
            <Text className="shrink text-lg font-bold text-white">{toast.text}</Text>
          </View>
        </View>
      )}
    </ToastContext>
  )
}

export function useToast(): (text: string, emoji?: string) => void {
  const show = use(ToastContext)
  if (!show) {
    throw new Error('useToast must be used inside ToastProvider')
  }
  return show
}
