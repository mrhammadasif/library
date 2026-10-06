import type { ComponentProps } from 'react'
import type { IBookEvent } from '~/models/IBook'
import { Feather } from '@expo/vector-icons'
import { Text, View } from 'react-native'
import { Colors } from '~/constants/Colors'
import { formatDate } from '~/utils/Dates'

const ICONS: Record<IBookEvent['type'], ComponentProps<typeof Feather>['name']> = {
  created: 'plus',
  moved: 'shuffle',
  lent: 'arrow-up-right',
  returned: 'arrow-down-left',
  archived: 'gift',
  restored: 'rotate-ccw',
  audited: 'check-square',
  marked_missing: 'alert-triangle',
}

function describe(event: IBookEvent, shelfName: (id: string | null) => string): string {
  const p = event.payload
  switch (event.type) {
    case 'created':
      return `📚 Added to ${shelfName(event.toShelfId)}`
    case 'moved':
      return `🚚 Moved to ${shelfName(event.toShelfId)}`
    case 'lent':
      return `📖 Borrowed by ${String(p.borrower ?? 'someone')}`
    case 'returned':
      return `🏠 Came back to ${shelfName(event.toShelfId)}`
    case 'archived':
      return p.reason === 'donated'
        ? `🎁 Given away${p.recipient ? ` to ${String(p.recipient)}` : ''}`
        : `👋 Left the shelves (${String(p.reason ?? 'other')})`
    case 'restored':
      return `↩️ Brought back to ${shelfName(event.toShelfId)}`
    case 'audited':
      return p.result === 'missing' ? '❓ Not found in a book check' : '✅ Spotted in a book check'
    case 'marked_missing':
      return '❓ Marked missing'
  }
}

export function Timeline({ events, shelfName }: { events: IBookEvent[], shelfName: (id: string | null) => string }) {
  return (
    <View>
      {events.map((event, i) => (
        <View key={event.id} className="flex-row gap-3">
          <View className="items-center">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-soft">
              <Feather name={ICONS[event.type]} size={14} color={Colors.primary} />
            </View>
            {i < events.length - 1 && <View className="w-px flex-1 bg-line" />}
          </View>
          <View className="flex-1 pb-4 pt-1">
            <Text className="text-base text-ink">{describe(event, shelfName)}</Text>
            <Text className="text-sm text-muted">
              {formatDate(event.at)}
              {event.actorName ? ` · ${event.actorName}` : ''}
            </Text>
          </View>
        </View>
      ))}
    </View>
  )
}
