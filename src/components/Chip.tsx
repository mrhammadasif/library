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
      className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${selected ? 'border-primary bg-primary-soft' : 'border-line bg-card'}`}
    >
      {swatch && <View className="h-3.5 w-3.5 rounded-full border border-line" style={{ backgroundColor: swatch }} />}
      <Text className={`text-sm ${selected ? 'font-semibold text-primary' : 'text-ink'}`}>{label}</Text>
      {onRemove && (
        <Pressable hitSlop={8} onPress={onRemove}>
          <Feather name="x" size={14} color={Colors.muted} />
        </Pressable>
      )}
    </Pressable>
  )
}
