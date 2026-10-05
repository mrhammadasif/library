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
}

const STYLES: Record<Variant, { box: string, text: string, color: string }> = {
  primary: { box: 'bg-primary', text: 'text-white', color: '#FFFFFF' },
  secondary: { box: 'border border-line bg-card', text: 'text-ink', color: Colors.ink },
  danger: { box: 'bg-negative-soft', text: 'text-negative', color: Colors.negative },
  ghost: { box: '', text: 'text-primary', color: Colors.primary },
}

export function Button({ label, onPress, variant = 'primary', icon, loading = false, disabled = false, small = false }: IButtonProps) {
  const style = STYLES[variant]
  const inactive = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      className={`flex-row items-center justify-center gap-2 rounded-2xl ${small ? 'px-4 py-2.5' : 'px-5 py-4'} ${style.box} ${inactive ? 'opacity-50' : ''}`}
    >
      {loading
        ? <ActivityIndicator color={style.color} />
        : icon && <Feather name={icon} size={small ? 16 : 18} color={style.color} />}
      <Text className={`${small ? 'text-sm' : 'text-base'} font-bold ${style.text}`}>{label}</Text>
    </Pressable>
  )
}
