import type { ComponentProps } from 'react'
import { Feather } from '@expo/vector-icons'
import { Pressable, View } from 'react-native'
import { Colors } from '~/constants/Colors'

interface IIconButtonProps {
  icon: ComponentProps<typeof Feather>['name']
  onPress: () => void
  dot?: boolean
}

/** Rounded white square button (bell, share, back). */
export function IconButton({ icon, onPress, dot = false }: IIconButtonProps) {
  return (
    <Pressable onPress={onPress} hitSlop={6} className="h-12 w-12 items-center justify-center rounded-2xl border border-line bg-card">
      <Feather name={icon} size={20} color={Colors.ink} />
      {dot && <View className="absolute right-3 top-3 h-2 w-2 rounded-full bg-negative" />}
    </Pressable>
  )
}
