import type { ReactNode } from 'react'
import { Feather } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Colors } from '~/constants/Colors'

/** "More details ▾": keeps rarely needed fields out of the way. */
export function Collapsible({ title, children, initiallyOpen = false }: { title: string, children: ReactNode, initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  return (
    <View className="gap-4">
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="min-h-12 flex-row items-center justify-between rounded-2xl border-2 border-line bg-card px-4"
      >
        <Text className="text-base font-semibold text-ink">{title}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={22} color={Colors.muted} />
      </Pressable>
      {open && children}
    </View>
  )
}
