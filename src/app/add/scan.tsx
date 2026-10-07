import type { IBook } from '~/models/IBook'
import { Feather } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { DateTime } from 'luxon'
import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useAuth } from '~/auth/AuthProvider'
import { BarcodeScanner } from '~/components/BarcodeScanner'
import { BookCover } from '~/components/BookCover'
import { Button } from '~/components/Button'
import { Location } from '~/components/Location'
import { SafeArea } from '~/components/SafeArea'
import { STATUS_WORDS } from '~/components/StatusBadge'
import { useToast } from '~/components/Toast'
import { findCopies, useMarkFound } from '~/hooks/Books'
import { useLendBook, useReturnBook } from '~/hooks/Loans'
import { shelfLabels, useRacks } from '~/hooks/Shelves'
import { useCan, useCurrentLibrary } from '~/library/LibraryProvider'
import { errorMessage } from '~/utils/Errors'

type ScanState =
  | { kind: 'idle' }
  | { kind: 'checking', isbn: string }
  | { kind: 'known', isbn: string, book: IBook, copies: number }
  | { kind: 'unknown', isbn: string }

/**
 * One scanner for everything. A book we already have shows where it lives with one-tap Borrow / Give back /
 * Found it; a new book goes straight to the add form (for people allowed to add books).
 */
export default function ScanScreen() {
  // Set when opened from a shelf ("Add a book here"): new books go on that shelf.
  const { shelfId } = useLocalSearchParams<{ shelfId?: string }>()
  const { library } = useCurrentLibrary()
  const { user } = useAuth()
  const toast = useToast()
  const racks = useRacks(library.id)
  const labels = shelfLabels(racks.data)
  const lend = useLendBook()
  const giveBack = useReturnBook()
  const markFound = useMarkFound()
  const can = { add: useCan('books.add'), loans: useCan('loans.manage'), audit: useCan('audits.run') }
  const [state, setState] = useState<ScanState>({ kind: 'idle' })
  const [error, setError] = useState<string | null>(null)

  async function onIsbn(isbn: string) {
    setError(null)
    setState({ kind: 'checking', isbn })
    try {
      const copies = (await findCopies(library.id, isbn)).filter(b => b.status !== 'archived')
      // Prefer a copy that's away (so "Give it back" is offered), else the first one.
      const book = copies.find(b => b.status === 'borrowed') ?? copies[0]
      if (book) {
        setState({ kind: 'known', isbn, book, copies: copies.length })
      }
      else if (can.add) {
        setState({ kind: 'idle' })
        router.push({ pathname: '/add/review', params: { isbn, from: 'scan', ...(shelfId ? { shelfId } : {}) } })
      }
      else {
        setState({ kind: 'unknown', isbn })
      }
    }
    catch (e) {
      setError(errorMessage(e))
      setState({ kind: 'idle' })
    }
  }

  const done = (message: string, emoji?: string) => {
    toast(message, emoji)
    setState({ kind: 'idle' })
  }
  const busy = lend.isPending || giveBack.isPending || markFound.isPending
  const shelf = (id: string | null) => (id ? labels.get(id) ?? 'its shelf' : 'its shelf')

  function renderKnown(book: IBook, copies: number, isbn: string) {
    const words = STATUS_WORDS[book.status]
    return (
      <View className="gap-4">
        <View className="flex-row gap-4">
          <BookCover title={book.title} coverPath={book.coverPath} coverUrl={book.coverUrl} color={book.dominantColor} width={72} />
          <View className="flex-1 gap-1">
            <Text className="text-sm font-semibold text-positive">{copies > 1 ? `You have ${copies} copies` : 'You have this book!'}</Text>
            <Text className="text-xl font-bold text-ink" numberOfLines={2}>{book.title}</Text>
            <Text className="text-base text-muted">{words.emoji} {words.label}</Text>
          </View>
        </View>
        <Location label={shelf(book.shelfId)} prefix={book.status === 'borrowed' ? 'Goes back on' : 'Lives on'} />
        {book.status === 'on_shelf' && can.loans && (
          <Button
            big
            icon="book-open"
            label="I'm borrowing it"
            loading={lend.isPending}
            onPress={() => lend.mutate(
              { libraryId: library.id, bookId: book.id, borrowerUserId: user!.id, dueAt: DateTime.now().plus({ days: 14 }).endOf('day').toISO() },
              { onSuccess: () => done('Enjoy the book! Back in 2 weeks', '📖') },
            )}
          />
        )}
        {book.status === 'borrowed' && can.loans && (
          <Button
            big
            icon="corner-down-left"
            label="I'm giving it back"
            loading={giveBack.isPending}
            onPress={() => giveBack.mutate({ libraryId: library.id, bookId: book.id }, { onSuccess: () => done(`Put it on ${shelf(book.shelfId)}`, '📍') })}
          />
        )}
        {book.status === 'missing' && can.audit && (
          <Button
            big
            icon="check"
            label="I found it!"
            loading={markFound.isPending}
            onPress={() => markFound.mutate({ libraryId: library.id, bookId: book.id }, { onSuccess: () => done('Found! Thank you', '🎉') })}
          />
        )}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button variant="secondary" icon="info" label="Open" onPress={() => router.push({ pathname: '/book/[id]', params: { id: book.id } })} />
          </View>
          <View className="flex-1">
            <Button variant="secondary" icon="maximize" label="Scan next" disabled={busy} onPress={() => setState({ kind: 'idle' })} />
          </View>
        </View>
        {can.add && (
          <Button small variant="ghost" icon="plus" label="Add another copy" onPress={() => router.push({ pathname: '/add/review', params: { isbn, from: 'scan', ...(shelfId ? { shelfId } : {}) } })} />
        )}
      </View>
    )
  }

  return (
    <SafeArea className="flex-1 bg-walnut">
      <View className="flex-row items-center justify-between px-5 py-3">
        <Pressable
          hitSlop={10}
          onPress={() => router.back()}
          accessibilityLabel="Close"
          className="h-12 w-12 items-center justify-center rounded-2xl bg-walnut-soft"
        >
          <Feather name="x" size={26} color="#fff" />
        </Pressable>
        <Text className="text-xl font-bold text-white">Scan a book</Text>
        <View className="w-12" />
      </View>

      <View className="mx-3 flex-1 overflow-hidden rounded-3xl">
        <BarcodeScanner onIsbn={onIsbn} paused={state.kind !== 'idle'} hint="Find the barcode on the back 👀" />
      </View>

      <View className="gap-3 rounded-t-3xl bg-canvas px-5 pb-4 pt-5">
        {state.kind === 'checking' && (
          <View className="flex-row items-center justify-center gap-3 py-6">
            <ActivityIndicator size="large" />
            <Text className="text-lg text-ink">Looking for it…</Text>
          </View>
        )}
        {state.kind === 'known' && renderKnown(state.book, state.copies, state.isbn)}
        {state.kind === 'unknown' && (
          <View className="gap-3">
            <Text className="text-xl font-bold text-ink">🤔 This book isn't in the library</Text>
            <Text className="text-base text-muted">Ask someone who looks after the library to add it.</Text>
            <Button variant="secondary" icon="maximize" label="Scan another" onPress={() => setState({ kind: 'idle' })} />
          </View>
        )}
        {state.kind === 'idle' && (
          <>
            {error && <Text className="text-center text-base text-negative">{error}</Text>}
            {shelfId && can.add && labels.get(shelfId) && (
              <Text className="text-center text-base text-muted">
                {'New books go on '}
                <Text className="font-bold text-ink">{labels.get(shelfId)}</Text>
              </Text>
            )}
            {can.add
              ? (
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Button variant="secondary" icon="camera" label="No barcode?" onPress={() => router.push({ pathname: '/add/photo', params: shelfId ? { shelfId } : {} })} />
                    </View>
                    <View className="flex-1">
                      <Button variant="secondary" icon="edit-3" label="Type it in" onPress={() => router.push({ pathname: '/add/review', params: { from: 'scan', ...(shelfId ? { shelfId } : {}) } })} />
                    </View>
                  </View>
                )
              : <Text className="py-2 text-center text-base text-muted">Scan any book to see where it lives.</Text>}
          </>
        )}
      </View>
    </SafeArea>
  )
}
