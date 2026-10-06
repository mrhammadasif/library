import type { IBook } from '~/models/IBook'
import { useWindowDimensions, View } from 'react-native'
import { BookTile } from '~/components/BookTile'

const GAP = 14

/** Width of one cover when `columns` covers fill the screen inside 20px side padding (+ optional card padding). */
export function useTileWidth(columns = 3, inset = 0): number {
  const { width } = useWindowDimensions()
  return Math.floor((width - 40 - inset - GAP * (columns - 1)) / columns)
}

interface IBookGridProps {
  books: IBook[]
  selected?: Set<string> | null
  onToggle?: (id: string) => void
  inset?: number
}

export function BookGrid({ books, selected, onToggle, inset = 0 }: IBookGridProps) {
  const width = useTileWidth(3, inset)
  return (
    <View className="flex-row flex-wrap" style={{ gap: GAP }}>
      {books.map(book => (
        <BookTile
          key={book.id}
          book={book}
          width={width}
          selected={selected?.has(book.id)}
          onToggle={selected && onToggle ? () => onToggle(book.id) : undefined}
        />
      ))}
    </View>
  )
}
