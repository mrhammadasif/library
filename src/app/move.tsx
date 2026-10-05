import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { Button } from '~/components/Button'
import { Loading } from '~/components/EmptyState'
import { Screen } from '~/components/Screen'
import { ShelfPicker } from '~/components/ShelfPicker'
import { useMoveBooks, useRestoreBook } from '~/hooks/Books'
import { useReturnBook } from '~/hooks/Loans'
import { useRacks } from '~/hooks/Shelves'
import { useCurrentLibrary } from '~/library/LibraryProvider'
import { errorMessage } from '~/utils/Errors'

type Mode = 'move' | 'return' | 'restore'

const COPY: Record<Mode, { title: string, action: string }> = {
  move: { title: 'Move to shelf', action: 'Move' },
  return: { title: 'Returned to which shelf?', action: 'Mark returned' },
  restore: { title: 'Restore to shelf', action: 'Restore' },
}

/** Shelf picker for moving books (?ids=a,b), returning a loan to another shelf, or restoring from the archive. */
export default function MoveScreen() {
  const params = useLocalSearchParams<{ ids: string, mode?: Mode, from?: string }>()
  const mode = params.mode ?? 'move'
  const ids = params.ids.split(',').filter(Boolean)
  const { library } = useCurrentLibrary()
  const racks = useRacks(library.id)
  const move = useMoveBooks()
  const returnBook = useReturnBook()
  const restore = useRestoreBook()
  const [shelfId, setShelfId] = useState<string | null>(null)
  const pending = move.isPending || returnBook.isPending || restore.isPending
  const error = move.error ?? returnBook.error ?? restore.error

  function submit() {
    if (!shelfId) {
      return
    }
    const done = { onSuccess: () => router.back() }
    if (mode === 'move') {
      move.mutate({ bookIds: ids, shelfId }, done)
    }
    else if (mode === 'return') {
      returnBook.mutate({ bookId: ids[0], shelfId }, done)
    }
    else {
      restore.mutate({ bookId: ids[0], shelfId }, done)
    }
  }

  return (
    <Screen>
      <View className="gap-1 pt-4">
        <Text className="text-2xl font-bold text-ink">{COPY[mode].title}</Text>
        {ids.length > 1 && <Text className="text-base text-muted">{ids.length} books</Text>}
      </View>
      {racks.data ? <ShelfPicker racks={racks.data} value={shelfId} onChange={setShelfId} exclude={params.from} /> : <Loading />}
      {error && <Text className="text-center text-sm text-negative">{errorMessage(error)}</Text>}
      <Button label={COPY[mode].action} disabled={!shelfId} loading={pending} onPress={submit} />
    </Screen>
  )
}
