import { Pressable, Text, View } from 'react-native'

export function SectionHeader({ title, action, onAction }: { title: string, action?: string, onAction?: () => void }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-xl font-bold text-ink">{title}</Text>
      {action && (
        <Pressable hitSlop={12} onPress={onAction} accessibilityRole="button">
          <Text className="text-base font-semibold text-primary">{action}</Text>
        </Pressable>
      )}
    </View>
  )
}
