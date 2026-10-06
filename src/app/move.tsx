import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { Button } from '~/components/Button'
import { Loading } from '~/components/EmptyState'
import { Screen } from '~/components/Screen'
import { useToast } from '~/components/Toast'
import { ShelfPicker } from '~/components/ShelfPicker'
import { useMoveBooks, useRestoreBook } from '~/hooks/Books'
import { useReturnBook } from '~/hooks/Loans'
import { shelfLabels, useRacks } from '~/hooks/Shelves'
import { useCurrentLibrary } from '~/library/LibraryProvider'
import { errorMessage } from '~/utils/Errors'

type Mode = 'move' | 'return' | 'restore'

const COPY: Record<Mode, { title: string, action: string, toast: string }> = {
  move: { title: 'Where does it go now?', action: 'Move it here', toast: 'Moved' },
  return: { title: 'Which shelf is it on now?', action: 'It\'s back here', toast: 'Welcome back' },
  restore: { title: 'Which shelf should it go on?', action: 'Put it back', toast: 'Back in the library' },
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
  const toast = useToast()
  const [shelfId, setShelfId] = useState<string | null>(null)
  const pending = move.isPending || returnBook.isPending || restore.isPending
  const error = move.error ?? returnBook.error ?? restore.error

  function submit() {
    if (!shelfId) {
      return
    }
    const target = shelfLabels(racks.data).get(shelfId)
    const done = {
      onSuccess: () => {
        toast(`${COPY[mode].toast}: ${target}`, '📍')
        router.back()
      },
    }
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
        {ids.length > 1 && <Text className="text-lg text-muted">{ids.length} books</Text>}
      </View>
      {racks.data ? <ShelfPicker racks={racks.data} value={shelfId} onChange={setShelfId} exclude={params.from} /> : <Loading />}
      {error && <Text className="text-center text-sm text-negative">{errorMessage(error)}</Text>}
      <Button big icon="check" label={COPY[mode].action} disabled={!shelfId} loading={pending} onPress={submit} />
    </Screen>
  )
}
