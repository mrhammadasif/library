import type { ComponentProps, ReactNode } from 'react'
import { Feather } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'
import { Colors, withAlpha } from '~/constants/Colors'

export function SettingsCard({ title, children }: { title?: string, children: ReactNode }) {
  return (
    <View className="gap-2">
      {title && <Text className="px-1 text-sm font-semibold uppercase tracking-wider text-faint">{title}</Text>}
      <View className="rounded-2xl border border-line bg-card px-4">{children}</View>
    </View>
  )
}

interface ISettingsRowProps {
  icon: ComponentProps<typeof Feather>['name']
  label: string
  hint?: string
  value?: string
  right?: ReactNode
  danger?: boolean
  last?: boolean
  onPress?: () => void
}

export function SettingsRow({ icon, label, hint, value, right, danger = false, last = false, onPress }: ISettingsRowProps) {
  const color = danger ? Colors.negative : Colors.primary
  return (
    <Pressable onPress={onPress} disabled={!onPress} className={`flex-row items-center gap-3 py-3.5 ${last ? '' : 'border-b border-line'}`}>
      <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(color, 0.1) }}>
        <Feather name={icon} size={18} color={color} />
      </View>
      <View className="flex-1">
        <Text className={`text-base font-medium ${danger ? 'text-negative' : 'text-ink'}`}>{label}</Text>
        {hint && <Text className="text-sm text-muted" numberOfLines={1}>{hint}</Text>}
      </View>
      {value && <Text className="text-base text-muted">{value}</Text>}
      {right ?? (onPress && !danger && <Feather name="chevron-right" size={18} color={Colors.faint} />)}
    </Pressable>
  )
}
