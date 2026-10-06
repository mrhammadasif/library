import type { BookStatus } from '~/models/IBook'
import { Text, View } from 'react-native'

export const STATUS_WORDS: Record<BookStatus, { label: string, emoji: string, box: string, text: string }> = {
  on_shelf: { label: 'On the shelf', emoji: '✅', box: 'bg-positive-soft', text: 'text-positive' },
  borrowed: { label: 'Borrowed', emoji: '📖', box: 'bg-warn-soft', text: 'text-warn' },
  missing: { label: 'Missing', emoji: '❓', box: 'bg-negative-soft', text: 'text-negative' },
  archived: { label: 'Given away', emoji: '🎁', box: 'bg-line', text: 'text-muted' },
}

export function StatusBadge({ status, label }: { status: BookStatus, label?: string }) {
  const words = STATUS_WORDS[status]
  return (
    <View className={`flex-row items-center gap-1 self-start rounded-full px-3 py-1 ${words.box}`}>
      <Text className="text-sm">{words.emoji}</Text>
      <Text className={`text-sm font-bold ${words.text}`}>{label ?? words.label}</Text>
    </View>
  )
}
