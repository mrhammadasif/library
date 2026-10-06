import { Feather } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'
import { Colors } from '~/constants/Colors'

interface IChipProps {
  label: string
  selected?: boolean
  onPress?: () => void
  onRemove?: () => void
  swatch?: string
}

export function Chip({ label, selected = false, onPress, onRemove, swatch }: IChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected }}
      className={`min-h-11 flex-row items-center gap-2 rounded-full border-2 px-4 py-2 ${selected ? 'border-primary bg-primary-soft' : 'border-line bg-card'}`}
    >
      {swatch && <View className="h-4 w-4 rounded-full border border-line" style={{ backgroundColor: swatch }} />}
      <Text className={`text-base ${selected ? 'font-bold text-primary' : 'text-ink'}`}>{label}</Text>
      {onRemove && (
        <Pressable hitSlop={10} onPress={onRemove} accessibilityLabel={`Remove ${label}`}>
          <Feather name="x" size={16} color={Colors.muted} />
        </Pressable>
      )}
    </Pressable>
  )
}
