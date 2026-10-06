import { Text, View } from 'react-native'

const TINTS = ['#F4D9A8', '#CDE5D6', '#D6E2F5', '#F2D0CB', '#E5D7F2', '#F5E3B3']

/** Initials in a circle, colour stable per name. */
export function Avatar({ name, size = 56 }: { name: string, size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?'
  const tint = TINTS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length]
  return (
    <View className="items-center justify-center rounded-full" style={{ width: size, height: size, backgroundColor: tint }}>
      <Text className="font-bold text-ink" style={{ fontSize: size / 2.6 }}>{initials}</Text>
    </View>
  )
}
