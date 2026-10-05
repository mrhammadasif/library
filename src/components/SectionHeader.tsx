import { Pressable, Text, View } from 'react-native'

export function SectionHeader({ title, action, onAction }: { title: string, action?: string, onAction?: () => void }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-lg font-bold text-ink">{title}</Text>
      {action && (
        <Pressable hitSlop={10} onPress={onAction}>
          <Text className="text-sm font-semibold text-primary">{action}</Text>
        </Pressable>
      )}
    </View>
  )
}
