import { router, useLocalSearchParams } from 'expo-router'
import { Alert, Text, View } from 'react-native'
import { BookCover } from '~/components/BookCover'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { Chip } from '~/components/Chip'
import { Empty, ErrorState, Loading } from '~/components/EmptyState'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { SectionHeader } from '~/components/SectionHeader'
import { StatusBadge } from '~/components/StatusBadge'
import { Timeline } from '~/components/Timeline'
import { BOOK_COLORS } from '~/constants/BookColors'
import { useBook, useBookEvents, useDeleteBook, useMarkFound } from '~/hooks/Books'
import { useBookLoans, useReturnBook } from '~/hooks/Loans'
import { shelfLabels, useRacks } from '~/hooks/Shelves'
import { useCan, useCurrentLibrary } from '~/library/LibraryProvider'
import { formatDate, formatRelative, isOverdue } from '~/utils/Dates'
import { errorMessage } from '~/utils/Errors'

function Detail({ label, value }: { label: string, value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  return (
    <View className="flex-row justify-between gap-4 border-b border-line py-2.5">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="flex-1 text-right text-sm text-ink">{value}</Text>
    </View>
  )
}

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { library } = useCurrentLibrary()
  const book = useBook(id)
  const events = useBookEvents(id)
  const loans = useBookLoans(id)
  const racks = useRacks(library.id)
  const labels = shelfLabels(racks.data)
  const returnBook = useReturnBook()
  const markFound = useMarkFound()
  const deleteBook = useDeleteBook()
  const can = {
    lend: useCan('loans.manage'),
    move: useCan('books.move'),
    archive: useCan('books.archive'),
    edit: useCan('books.edit'),
    del: useCan('books.delete'),
    audit: useCan('audits.run'),
  }

  if (book.isPending) {
    return <Screen header={<Header title="" />}><Loading /></Screen>
  }
  if (book.error || !book.data) {
    return (
      <Screen header={<Header title="Book" />}>
        {book.error ? <ErrorState error={book.error} onRetry={book.refetch} /> : <Empty text="This book was deleted." />}
      </Screen>
    )
  }
  const b = book.data
  const openLoan = loans.data?.find(l => !l.returnedAt)
  const shelfName = (shelfId: string | null) => (shelfId ? labels.get(shelfId) ?? 'a removed shelf' : 'no shelf')
  const color = BOOK_COLORS.find(c => c.name === b.colorName)
  const mutationError = returnBook.error ?? markFound.error ?? deleteBook.error

  function confirmDelete() {
    Alert.alert('Delete this book?', 'Its history and loans are removed too. To keep a record, donate or archive it instead.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteBook.mutate(b.id, { onSuccess: () => router.back() }) },
    ])
  }

  return (
    <Screen
      header={<Header title="" right={can.edit && <Button small variant="secondary" icon="edit-3" label="Edit" onPress={() => router.push({ pathname: '/book/edit/[id]', params: { id: b.id } })} />} />}
      refreshing={book.isRefetching}
      onRefresh={() => {
        book.refetch()
        events.refetch()
        loans.refetch()
      }}
    >
      <View className="flex-row gap-4">
        <BookCover title={b.title} coverPath={b.coverPath} coverUrl={b.coverUrl} color={b.dominantColor} width={110} />
        <View className="flex-1 gap-1.5">
          <Text className="text-2xl font-bold text-ink">{b.title}</Text>
          {b.subtitle && <Text className="text-base text-muted">{b.subtitle}</Text>}
          {b.authors.length > 0 && <Text className="text-base text-ink">{b.authors.join(', ')}</Text>}
          <StatusBadge status={b.status} />
          <Text className="text-sm text-muted">
            {b.status === 'archived'
              ? b.donatedTo ? `Donated to ${b.donatedTo}` : `Archived ${formatDate(b.archivedAt)}`
              : shelfName(b.shelfId)}
          </Text>
        </View>
      </View>

      {openLoan && (
        <Card className={`gap-1 py-3 ${isOverdue(openLoan.dueAt) ? 'border-negative bg-negative-soft' : 'bg-warn-soft'}`}>
          <Text className="text-base font-semibold text-ink">Lent to {openLoan.borrowerName}</Text>
          <Text className="text-sm text-muted">
            Since {formatDate(openLoan.lentAt)}
            {openLoan.dueAt ? ` · due ${formatRelative(openLoan.dueAt)}` : ''}
            {openLoan.borrowerContact ? ` · ${openLoan.borrowerContact}` : ''}
          </Text>
        </Card>
      )}

      <View className="gap-3">
        {b.status === 'on_shelf' && can.lend && (
          <Button icon="arrow-up-right" label="Lend" onPress={() => router.push({ pathname: '/lend/[bookId]', params: { bookId: b.id } })} />
        )}
        {b.status === 'borrowed' && can.lend && (
          <Button icon="arrow-down-left" label={`Returned to ${shelfName(b.shelfId)}`} loading={returnBook.isPending} onPress={() => returnBook.mutate({ bookId: b.id })} />
        )}
        {b.status === 'borrowed' && can.lend && can.move && (
          <Button variant="secondary" label="Returned to a different shelf" onPress={() => router.push({ pathname: '/move', params: { ids: b.id, mode: 'return' } })} />
        )}
        {b.status === 'missing' && can.audit && (
          <Button icon="check" label="I found it" loading={markFound.isPending} onPress={() => markFound.mutate({ bookId: b.id })} />
        )}
        {b.status === 'archived' && can.archive && (
          <Button icon="rotate-ccw" label="Restore to a shelf" onPress={() => router.push({ pathname: '/move', params: { ids: b.id, mode: 'restore' } })} />
        )}
        <View className="flex-row gap-3">
          {b.status !== 'archived' && can.move && (
            <View className="flex-1"><Button variant="secondary" icon="shuffle" label="Move" onPress={() => router.push({ pathname: '/move', params: { ids: b.id, from: b.shelfId ?? '' } })} /></View>
          )}
          {b.status !== 'archived' && can.archive && (
            <View className="flex-1"><Button variant="secondary" icon="gift" label="Donate" onPress={() => router.push({ pathname: '/donate', params: { ids: b.id } })} /></View>
          )}
        </View>
        {mutationError && <Text className="text-center text-sm text-negative">{errorMessage(mutationError)}</Text>}
      </View>

      {(b.tags.length > 0 || b.categories.length > 0) && (
        <View className="flex-row flex-wrap gap-2">
          {b.categories.map(c => <Chip key={`c-${c}`} label={c} />)}
          {b.tags.map(t => <Chip key={`t-${t}`} label={`#${t}`} onPress={() => router.navigate({ pathname: '/search', params: { q: t } })} />)}
        </View>
      )}

      {b.description && <Text className="text-base leading-6 text-ink">{b.description}</Text>}

      <Card>
        <Detail label="ISBN" value={b.isbn13 ?? b.isbn10} />
        <Detail label="Publisher" value={b.publisher} />
        <Detail label="Published" value={b.publishedYear} />
        <Detail label="Pages" value={b.pages} />
        <Detail label="Language" value={b.language?.toUpperCase()} />
        <Detail label="Colour" value={color?.label} />
        <Detail label="Condition" value={b.condition} />
        <Detail label="Notes" value={b.notes} />
        <Detail label="Last seen" value={b.lastSeenAt ? formatDate(b.lastSeenAt) : 'Never checked'} />
        <Detail label="Added" value={formatDate(b.createdAt)} />
      </Card>

      <View className="gap-3">
        <SectionHeader title="History" />
        {events.data?.length ? <Timeline events={events.data} shelfName={shelfName} /> : <Loading />}
      </View>

      {can.del && <Button variant="danger" icon="trash-2" label="Delete book" onPress={confirmDelete} />}
    </Screen>
  )
}
