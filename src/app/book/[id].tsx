import type { ComponentProps } from 'react'
import { Feather } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { DateTime } from 'luxon'
import { Alert, Pressable, Text, View } from 'react-native'
import { useAuth } from '~/auth/AuthProvider'
import { Avatar } from '~/components/Avatar'
import { BookCover } from '~/components/BookCover'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { Chip } from '~/components/Chip'
import { Collapsible } from '~/components/Collapsible'
import { Empty, ErrorState, Loading } from '~/components/EmptyState'
import { Header } from '~/components/Header'
import { Location } from '~/components/Location'
import { Screen } from '~/components/Screen'
import { Timeline } from '~/components/Timeline'
import { useToast } from '~/components/Toast'
import { BOOK_COLORS } from '~/constants/BookColors'
import { Colors } from '~/constants/Colors'
import { useBook, useBookEvents, useDeleteBook, useMarkFound } from '~/hooks/Books'
import { useBookLoans, useLendBook, useReturnBook } from '~/hooks/Loans'
import { shelfLabels, useRacks } from '~/hooks/Shelves'
import { useCan, useCurrentLibrary } from '~/library/LibraryProvider'
import { formatDate, formatRelative, isOverdue } from '~/utils/Dates'
import { errorMessage } from '~/utils/Errors'

function Detail({ label, value }: { label: string, value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  return (
    <View className="flex-row justify-between gap-4 border-b border-line py-3">
      <Text className="text-base text-muted">{label}</Text>
      <Text className="flex-1 text-right text-base text-ink">{value}</Text>
    </View>
  )
}

function SmallAction({ icon, label, onPress }: { icon: ComponentProps<typeof Feather>['name'], label: string, onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="min-h-20 flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 border-line bg-card p-3 active:opacity-80"
    >
      <Feather name={icon} size={24} color={Colors.primary} />
      <Text className="text-sm font-semibold text-ink">{label}</Text>
    </Pressable>
  )
}

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { library } = useCurrentLibrary()
  const { user } = useAuth()
  const toast = useToast()
  const book = useBook(library.id, id)
  const events = useBookEvents(library.id, id)
  const loans = useBookLoans(library.id, id)
  const racks = useRacks(library.id)
  const labels = shelfLabels(racks.data)
  const lend = useLendBook()
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
        {book.error ? <ErrorState error={book.error} onRetry={book.refetch} /> : <Empty text="This book isn't here any more." />}
      </Screen>
    )
  }
  const b = book.data
  const openLoan = loans.data?.find(l => !l.returnedAt)
  const shelfName = (shelfId: string | null) => (shelfId ? labels.get(shelfId) ?? 'a removed shelf' : 'no shelf')
  const color = BOOK_COLORS.find(c => c.name === b.colorName)
  const mutationError = lend.error ?? returnBook.error ?? markFound.error ?? deleteBook.error
  const late = openLoan && isOverdue(openLoan.dueAt)

  function confirmDelete() {
    Alert.alert('Delete this book for good?', 'Its history goes too. To keep a record, choose “Give away” instead.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteBook.mutate({ libraryId: library.id, id: b.id }, { onSuccess: () => router.back() }) },
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
      <View className="items-center gap-3">
        <BookCover title={b.title} coverPath={b.coverPath} coverUrl={b.coverUrl} color={b.dominantColor} width={160} />
        <View className="items-center gap-1 px-2">
          <Text className="text-center text-3xl font-bold text-ink">{b.title}</Text>
          {b.subtitle && <Text className="text-center text-base text-muted">{b.subtitle}</Text>}
          {b.authors.length > 0 && <Text className="text-center text-lg text-ink">{b.authors.join(', ')}</Text>}
        </View>
      </View>

      {b.status === 'on_shelf' && <Location label={shelfName(b.shelfId)} />}
      {b.status === 'borrowed' && openLoan && (
        <Card className={`gap-3 py-4 ${late ? 'border-negative bg-negative-soft' : 'bg-warn-soft'}`}>
          <View className="flex-row items-center gap-3">
            <Avatar name={openLoan.borrowerName} size={52} />
            <View className="flex-1">
              <Text className="text-xl font-bold text-ink">
                {openLoan.borrowerUserId === user?.id ? 'You have it' : `${openLoan.borrowerName} has it`}
              </Text>
              <Text className={`text-base ${late ? 'font-bold text-negative' : 'text-muted'}`}>
                {openLoan.dueAt ? `${late ? '⏰ Was due' : 'Back'} ${formatRelative(openLoan.dueAt)}` : `Since ${formatDate(openLoan.lentAt)}`}
                {openLoan.borrowerContact ? ` · ${openLoan.borrowerContact}` : ''}
              </Text>
            </View>
          </View>
          <Text className="text-base text-muted">📍 Goes back on {shelfName(b.shelfId)}</Text>
        </Card>
      )}
      {b.status === 'missing' && (
        <Card className="gap-1 border-negative bg-negative-soft py-4">
          <Text className="text-xl font-bold text-ink">❓ We can't find this book</Text>
          <Text className="text-base text-muted">It should be on {shelfName(b.shelfId)}.</Text>
        </Card>
      )}
      {b.status === 'archived' && (
        <Card className="gap-1 py-4">
          <Text className="text-xl font-bold text-ink">
            🎁 {b.archiveReason === 'donated' ? `Given away${b.donatedTo ? ` to ${b.donatedTo}` : ''}` : `No longer here (${b.archiveReason ?? 'archived'})`}
          </Text>
          <Text className="text-base text-muted">{formatDate(b.archivedAt)}</Text>
        </Card>
      )}

      <View className="gap-3">
        {b.status === 'on_shelf' && can.lend && (
          <>
            <Button
              big
              icon="book-open"
              label="I'm borrowing it"
              loading={lend.isPending}
              onPress={() => lend.mutate(
                { libraryId: library.id, bookId: b.id, borrowerUserId: user!.id, dueAt: DateTime.now().plus({ days: 14 }).endOf('day').toISO() },
                { onSuccess: () => toast('Enjoy the book! Back in 2 weeks', '📖') },
              )}
            />
            <Button variant="secondary" icon="users" label="Lend to someone else" onPress={() => router.push({ pathname: '/lend/[bookId]', params: { bookId: b.id } })} />
          </>
        )}
        {b.status === 'borrowed' && can.lend && (
          <Button
            big
            icon="corner-down-left"
            label="It's back!"
            loading={returnBook.isPending}
            onPress={() => returnBook.mutate({ libraryId: library.id, bookId: b.id }, { onSuccess: () => toast(`Put it on ${shelfName(b.shelfId)}`, '📍') })}
          />
        )}
        {b.status === 'borrowed' && can.lend && can.move && (
          <Button small variant="ghost" label="It goes on a different shelf now" onPress={() => router.push({ pathname: '/move', params: { ids: b.id, mode: 'return' } })} />
        )}
        {b.status === 'missing' && can.audit && (
          <Button big icon="check" label="I found it!" loading={markFound.isPending} onPress={() => markFound.mutate({ libraryId: library.id, bookId: b.id }, { onSuccess: () => toast('Found! Thank you', '🎉') })} />
        )}
        {b.status === 'archived' && can.archive && (
          <Button big icon="rotate-ccw" label="Bring it back" onPress={() => router.push({ pathname: '/move', params: { ids: b.id, mode: 'restore' } })} />
        )}
        {b.status !== 'archived' && (can.move || can.archive) && (
          <View className="flex-row gap-3">
            {can.move && <SmallAction icon="shuffle" label="Move" onPress={() => router.push({ pathname: '/move', params: { ids: b.id, from: b.shelfId ?? '' } })} />}
            {can.archive && <SmallAction icon="gift" label="Give away" onPress={() => router.push({ pathname: '/donate', params: { ids: b.id } })} />}
          </View>
        )}
        {mutationError && <Text className="text-center text-base text-negative">{errorMessage(mutationError)}</Text>}
      </View>

      {(b.tags.length > 0 || b.categories.length > 0) && (
        <View className="flex-row flex-wrap gap-2">
          {b.categories.map(c => <Chip key={`c-${c}`} label={c} />)}
          {b.tags.map(t => <Chip key={`t-${t}`} label={`#${t}`} onPress={() => router.navigate({ pathname: '/search', params: { q: t } })} />)}
        </View>
      )}

      {b.description && (
        <View className="gap-2">
          <Text className="text-xl font-bold text-ink">What's it about?</Text>
          {/* lineHeight as a style: NativeWind v5 rc turns `leading-*` (calc(var(--spacing) * n)) into a huge gap on devices. */}
          <Text className="text-base text-ink" style={{ lineHeight: 24 }} testID="book-description">{b.description}</Text>
        </View>
      )}

      <Collapsible title="More details">
        <Card>
          <Detail label="ISBN" value={b.isbn13 ?? b.isbn10} />
          <Detail label="Publisher" value={b.publisher} />
          <Detail label="Published" value={b.publishedYear} />
          <Detail label="Pages" value={b.pages} />
          <Detail label="Language" value={b.language?.toUpperCase()} />
          <Detail label="Colour" value={color?.label} />
          <Detail label="Condition" value={b.condition} />
          <Detail label="Notes" value={b.notes} />
          <Detail label="Last checked" value={b.lastSeenAt ? formatDate(b.lastSeenAt) : 'Never'} />
          <Detail label="Added" value={formatDate(b.createdAt)} />
        </Card>
        {can.del && <Button variant="danger" icon="trash-2" label="Delete book" onPress={confirmDelete} />}
      </Collapsible>

      <Collapsible title="What happened to this book">
        {events.data?.length ? <Timeline events={events.data} shelfName={shelfName} /> : <Loading />}
      </Collapsible>
    </Screen>
  )
}
