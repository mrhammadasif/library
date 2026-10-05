import type { BookStatus } from '~/models/IBook'
import { Text, View } from 'react-native'

const STYLES: Record<BookStatus, { label: string, box: string, text: string }> = {
  on_shelf: { label: 'On shelf', box: 'bg-positive-soft', text: 'text-positive' },
  borrowed: { label: 'Lent out', box: 'bg-warn-soft', text: 'text-warn' },
  missing: { label: 'Missing', box: 'bg-negative-soft', text: 'text-negative' },
  archived: { label: 'Archived', box: 'bg-line', text: 'text-muted' },
}

export function StatusBadge({ status, label }: { status: BookStatus, label?: string }) {
  const style = STYLES[status]
  return (
    <View className={`self-start rounded-full px-2.5 py-0.5 ${style.box}`}>
      <Text className={`text-xs font-semibold ${style.text}`}>{label ?? style.label}</Text>
    </View>
  )
}
