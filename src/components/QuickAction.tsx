import type { ComponentProps } from 'react'
import { Feather } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'
import { Colors } from '~/constants/Colors'

interface IQuickActionProps {
  icon: ComponentProps<typeof Feather>['name']
  label: string
  onPress: () => void
  /** Filled walnut icon for the primary action. */
  primary?: boolean
  badge?: number
}

export function QuickAction({ icon, label, onPress, primary = false, badge = 0 }: IQuickActionProps) {
  return (
    <Pressable onPress={onPress} className="flex-1 items-center gap-3 rounded-2xl border border-line bg-card px-1 py-4">
      <View className={`h-11 w-11 items-center justify-center rounded-full ${primary ? 'bg-walnut' : ''}`}>
        <Feather name={icon} size={primary ? 22 : 26} color={primary ? '#fff' : Colors.ink} />
        {badge > 0 && (
          <View className="absolute -right-2 -top-1 min-w-5 items-center rounded-full bg-warn px-1.5 py-0.5">
            <Text className="text-[10px] font-bold text-white">{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </View>
      <Text className="text-center text-xs font-medium text-ink" numberOfLines={1}>{label}</Text>
    </Pressable>
  )
}
