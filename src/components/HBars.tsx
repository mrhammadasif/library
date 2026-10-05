import { Text, View } from 'react-native'
import { Colors } from '~/constants/Colors'

interface IBar {
  label: string
  value: number
  /** Only for bars whose identity *is* a colour (book colours); everything else uses the single primary hue. */
  color?: string
}

/** Ranked horizontal bars, direct-labelled with their values (single series, so no legend). */
export function HBars({ bars, max }: { bars: IBar[], max?: number }) {
  const top = max ?? Math.max(1, ...bars.map(b => b.value))
  return (
    <View className="gap-2.5">
      {bars.map(bar => (
        <View key={bar.label} className="gap-1">
          <View className="flex-row justify-between">
            <Text className="flex-1 text-sm text-ink" numberOfLines={1}>{bar.label}</Text>
            <Text className="text-sm font-semibold text-muted">{bar.value}</Text>
          </View>
          <View className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: Colors.line }}>
            <View
              className="h-full rounded-full"
              style={{ width: `${(bar.value / top) * 100}%`, backgroundColor: bar.color ?? Colors.primary }}
            />
          </View>
        </View>
      ))}
    </View>
  )
}
