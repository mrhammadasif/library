import type { ComponentProps } from 'react'
import { Feather } from '@expo/vector-icons'
import { ActivityIndicator, Pressable, Text } from 'react-native'
import { Colors } from '~/constants/Colors'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface IButtonProps {
  label: string
  onPress: () => void
  variant?: Variant
  icon?: ComponentProps<typeof Feather>['name']
  loading?: boolean
  disabled?: boolean
  small?: boolean
  /** Extra-large call to action (one per screen). */
  big?: boolean
}

const STYLES: Record<Variant, { box: string, text: string, color: string }> = {
  primary: { box: 'bg-primary', text: 'text-white', color: '#FFFFFF' },
  secondary: { box: 'border-2 border-line bg-card', text: 'text-ink', color: Colors.ink },
  danger: { box: 'bg-negative-soft', text: 'text-negative', color: Colors.negative },
  ghost: { box: '', text: 'text-primary', color: Colors.primary },
}

export function Button({ label, onPress, variant = 'primary', icon, loading = false, disabled = false, small = false, big = false }: IButtonProps) {
  const style = STYLES[variant]
  const inactive = disabled || loading
  const size = big ? 'min-h-16 px-6 py-4' : small ? 'min-h-11 px-4 py-2' : 'min-h-14 px-5 py-3.5'
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      className={`flex-row items-center justify-center gap-2 rounded-2xl active:opacity-80 ${size} ${style.box} ${inactive ? 'opacity-50' : ''}`}
    >
      {loading
        ? <ActivityIndicator color={style.color} />
        : icon && <Feather name={icon} size={big ? 24 : small ? 16 : 20} color={style.color} />}
      <Text className={`${big ? 'text-xl' : small ? 'text-sm' : 'text-lg'} font-bold ${style.text}`}>{label}</Text>
    </Pressable>
  )
}
