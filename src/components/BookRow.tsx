import type { IBook } from '~/models/IBook'
import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { BookCover } from '~/components/BookCover'
import { StatusBadge } from '~/components/StatusBadge'
import { Colors } from '~/constants/Colors'

interface IBookRowProps {
  book: IBook
  shelfLabel?: string
  /** Multi-select mode: shows a checkbox and calls onToggle instead of opening the book. */
  selected?: boolean
  onToggle?: () => void
  last?: boolean
}

export function BookRow({ book, shelfLabel, selected, onToggle, last = false }: IBookRowProps) {
  const selecting = onToggle !== undefined
  return (
    <Pressable
      onPress={selecting ? onToggle : () => router.push({ pathname: '/book/[id]', params: { id: book.id } })}
      onLongPress={onToggle}
      className={`flex-row items-center gap-3 py-3 ${last ? '' : 'border-b border-line'}`}
    >
      {selecting && (
        <View className={`h-6 w-6 items-center justify-center rounded-md border ${selected ? 'border-primary bg-primary' : 'border-faint'}`}>
          {selected && <Feather name="check" size={16} color="#fff" />}
        </View>
      )}
      <BookCover title={book.title} coverPath={book.coverPath} coverUrl={book.coverUrl} color={book.dominantColor} width={44} />
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-semibold text-ink" numberOfLines={2}>{book.title}</Text>
        {book.authors.length > 0 && <Text className="text-sm text-muted" numberOfLines={1}>{book.authors.join(', ')}</Text>}
        <View className="mt-1 flex-row items-center gap-2">
          {book.status !== 'on_shelf' && <StatusBadge status={book.status} />}
          {shelfLabel && <Text className="flex-1 text-xs text-faint" numberOfLines={1}>{shelfLabel}</Text>}
        </View>
      </View>
      {!selecting && <Feather name="chevron-right" size={18} color={Colors.faint} />}
    </Pressable>
  )
}
