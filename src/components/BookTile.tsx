import type { IBook } from '~/models/IBook'
import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { BookCover } from '~/components/BookCover'
import { STATUS_WORDS } from '~/components/StatusBadge'

interface IBookTileProps {
  book: Pick<IBook, 'id' | 'title' | 'coverPath' | 'coverUrl' | 'dominantColor' | 'status'>
  width: number
  selected?: boolean
  /** Selection mode: tapping toggles instead of opening the book. */
  onToggle?: () => void
  showTitle?: boolean
}

/** A cover you can tap: the way kids (and most people) recognise a book. */
export function BookTile({ book, width, selected, onToggle, showTitle = true }: IBookTileProps) {
  const away = book.status !== 'on_shelf' ? STATUS_WORDS[book.status] : null
  return (
    <Pressable
      onPress={onToggle ?? (() => router.push({ pathname: '/book/[id]', params: { id: book.id } }))}
      onLongPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${book.title}${away ? `, ${away.label}` : ''}`}
      className="gap-1.5 active:opacity-80"
      style={{ width }}
    >
      <View>
        <BookCover title={book.title} coverPath={book.coverPath} coverUrl={book.coverUrl} color={book.dominantColor} width={width} />
        {away && (
          <View className="absolute left-1 top-1 rounded-full bg-card px-1.5 py-0.5">
            <Text className="text-sm">{away.emoji}</Text>
          </View>
        )}
        {onToggle && (
          <View className={`absolute right-1 top-1 h-7 w-7 items-center justify-center rounded-full border-2 border-white ${selected ? 'bg-primary' : 'bg-[#00000040]'}`}>
            {selected && <Feather name="check" size={16} color="#fff" />}
          </View>
        )}
      </View>
      {showTitle && <Text className="text-sm font-semibold text-ink" numberOfLines={2}>{book.title}</Text>}
    </Pressable>
  )
}
