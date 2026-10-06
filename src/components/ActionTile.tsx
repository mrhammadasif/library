import { Pressable, Text, View } from 'react-native'

interface IActionTileProps {
  emoji: string
  label: string
  hint?: string
  /** Tile background, a soft tint. */
  tint: string
  onPress: () => void
  badge?: number
}

/** Big, colourful, picture-first button for the main things people do. */
export function ActionTile({ emoji, label, hint, tint, onPress, badge = 0 }: IActionTileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      className="min-h-32 flex-1 justify-between rounded-3xl p-4 active:opacity-80"
      style={{ backgroundColor: tint }}
    >
      <View className="flex-row items-start justify-between">
        <Text className="text-4xl">{emoji}</Text>
        {badge > 0 && (
          <View className="min-w-7 items-center rounded-full bg-negative px-2 py-0.5">
            <Text className="text-sm font-bold text-white">{badge}</Text>
          </View>
        )}
      </View>
      <View>
        <Text className="text-xl font-bold text-ink">{label}</Text>
        {hint && <Text className="text-sm text-muted" numberOfLines={2}>{hint}</Text>}
      </View>
    </Pressable>
  )
}
