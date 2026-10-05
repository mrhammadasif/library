import { Text, View } from 'react-native'

export function StatTile({ label, value, tone = 'ink' }: { label: string, value: string | number, tone?: 'ink' | 'warn' | 'negative' | 'positive' }) {
  const color = { ink: 'text-ink', warn: 'text-warn', negative: 'text-negative', positive: 'text-positive' }[tone]
  return (
    <View className="flex-1 gap-1 rounded-2xl border border-line bg-card p-4">
      <Text className={`text-2xl font-bold ${color}`}>{value}</Text>
      <Text className="text-xs font-medium text-muted" numberOfLines={1}>{label}</Text>
    </View>
  )
}
