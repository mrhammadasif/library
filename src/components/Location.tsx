import { Text, View } from 'react-native'

/** "📍 Living room · Top shelf", big enough to read across the room. */
export function Location({ label, prefix = 'Lives on' }: { label: string, prefix?: string }) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-primary-soft px-4 py-3">
      <Text className="text-2xl">📍</Text>
      <View className="flex-1">
        <Text className="text-sm text-muted">{prefix}</Text>
        <Text className="text-lg font-bold text-primary">{label}</Text>
      </View>
    </View>
  )
}
