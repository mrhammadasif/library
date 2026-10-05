import type { ColorName } from '~/constants/BookColors'
import { Feather } from '@expo/vector-icons'
import { Pressable, View } from 'react-native'
import { BOOK_COLORS } from '~/constants/BookColors'

interface IColorSwatchesProps {
  value: ColorName | null
  onChange: (color: ColorName | null) => void
}

/** Tappable colour dots; tapping the selected one clears it. */
export function ColorSwatches({ value, onChange }: IColorSwatchesProps) {
  return (
    <View className="flex-row flex-wrap gap-2.5">
      {BOOK_COLORS.map(c => (
        <Pressable
          key={c.name}
          accessibilityLabel={c.label}
          onPress={() => onChange(value === c.name ? null : c.name)}
          className={`h-9 w-9 items-center justify-center rounded-full border-2 ${value === c.name ? 'border-primary' : 'border-line'}`}
          style={{ backgroundColor: c.swatch }}
        >
          {value === c.name && <Feather name="check" size={16} color={c.name === 'white' || c.name === 'yellow' ? '#000' : '#fff'} />}
        </Pressable>
      ))}
    </View>
  )
}
