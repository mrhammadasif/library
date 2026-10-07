import type { IBook } from '~/models/IBook'
import { router } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { BookCover } from '~/components/BookCover'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { Empty, ErrorState, Loading } from '~/components/EmptyState'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { useToast } from '~/components/Toast'
import { useMarkFound, useMissingBooks } from '~/hooks/Books'
import { shelfLabels, useRacks } from '~/hooks/Shelves'
import { useCan, useCurrentLibrary } from '~/library/LibraryProvider'
import { errorMessage } from '~/utils/Errors'

/**
 * Every book a book check couldn't find, with the three ways to sort it out: it turned up (back on its shelf), someone
 * has it (recorded as borrowed), or it's gone for good (given away / lost).
 */
export default function MissingBooksScreen() {
  const { library } = useCurrentLibrary()
  const books = useMissingBooks(library.id)
  const racks = useRacks(library.id)
  const markFound = useMarkFound()
  const toast = useToast()
  const can = { found: useCan('audits.run'), lend: useCan('loans.manage'), archive: useCan('books.archive') }
  const labels = shelfLabels(racks.data)
  const list = books.data ?? []

  function found(book: IBook) {
    markFound.mutate({ libraryId: library.id, bookId: book.id }, { onSuccess: () => toast(`Found! Back on ${labels.get(book.shelfId ?? '') ?? 'its shelf'}`, '🎉') })
  }

  return (
    <Screen
      header={<Header title="Missing books" subtitle={list.length ? `${list.length} to sort out` : library.name} />}
      refreshing={books.isRefetching}
      onRefresh={books.refetch}
    >
      {books.isPending && <Loading />}
      {books.error && <ErrorState error={books.error} onRetry={books.refetch} />}
      {books.data && list.length === 0 && <Empty text="🎉 Nothing is missing. Every book is where it should be." />}
      {list.length > 0 && (
        <Text className="text-base text-muted">
          A book check couldn't find these. Look around, ask the family, then tell us what happened.
        </Text>
      )}
      {list.map(book => (
        <Card key={book.id} className="gap-3 py-4">
          <Pressable
            onPress={() => router.push({ pathname: '/book/[id]', params: { id: book.id } })}
            accessibilityRole="button"
            className="flex-row items-center gap-3"
          >
            <BookCover title={book.title} coverPath={book.coverPath} coverUrl={book.coverUrl} color={book.dominantColor} width={56} />
            <View className="flex-1">
              <Text className="text-lg font-bold text-ink" numberOfLines={2}>{book.title}</Text>
              <Text className="text-sm text-muted" numberOfLines={1}>{`Should be on ${labels.get(book.shelfId ?? '') ?? 'its shelf'}`}</Text>
            </View>
          </Pressable>
          <View className="gap-2">
            {can.found && <Button small icon="check" label="I found it" loading={markFound.isPending && markFound.variables?.bookId === book.id} onPress={() => found(book)} />}
            <View className="flex-row gap-2">
              {can.lend && (
                <View className="flex-1">
                  <Button small variant="secondary" icon="users" label="Someone has it" onPress={() => router.push({ pathname: '/lend/[bookId]', params: { bookId: book.id } })} />
                </View>
              )}
              {can.archive && (
                <View className="flex-1">
                  <Button small variant="secondary" icon="x-circle" label="Gone for good" onPress={() => router.push({ pathname: '/donate', params: { ids: book.id } })} />
                </View>
              )}
            </View>
          </View>
        </Card>
      ))}
      {markFound.error && <Text className="text-center text-base text-negative">{errorMessage(markFound.error)}</Text>}
    </Screen>
  )
}
