import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { BookGrid } from '~/components/BookGrid'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { Empty, ErrorState, Loading } from '~/components/EmptyState'
import { Field } from '~/components/Field'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { useShelfBooks } from '~/hooks/Books'
import { useDeleteShelf, useRacks, useSaveShelf } from '~/hooks/Shelves'
import { useCan, useCurrentLibrary } from '~/library/LibraryProvider'
import { errorMessage } from '~/utils/Errors'

/** What's on a shelf. Long-press a book to select several, then move or donate them together. */
export default function ShelfScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { library } = useCurrentLibrary()
  const racks = useRacks(library.id)
  const books = useShelfBooks(id)
  const saveShelf = useSaveShelf()
  const deleteShelf = useDeleteShelf()
  const canManage = useCan('shelves.manage')
  const canMove = useCan('books.move')
  const canArchive = useCan('books.archive')
  const canAudit = useCan('audits.run')
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [rename, setRename] = useState<string | null>(null)

  const rack = racks.data?.find(r => r.shelves.some(s => s.id === id))
  const shelf = rack?.shelves.find(s => s.id === id)
  const list = books.data ?? []
  const away = list.filter(b => b.status !== 'on_shelf').length

  function toggle(bookId: string) {
    const next = new Set(selected ?? [])
    if (next.has(bookId)) {
      next.delete(bookId)
    }
    else {
      next.add(bookId)
    }
    setSelected(next)
  }

  function confirmDelete() {
    Alert.alert(`Delete "${shelf?.name}"?`, 'Only empty shelves can be deleted: move the books first.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteShelf.mutate(id, { onSuccess: () => router.back() }) },
    ])
  }

  const ids = [...(selected ?? [])].join(',')
  return (
    <Screen
      header={(
        <Header
          title={shelf?.name ?? 'Shelf'}
          subtitle={rack ? `📚 ${rack.name} · ${list.length} books${away ? ` · ${away} away` : ''}` : undefined}
          right={(canMove || canArchive) && list.length > 0 && (
            <Button small variant="secondary" label={selected ? 'Cancel' : 'Select'} onPress={() => setSelected(selected ? null : new Set())} />
          )}
        />
      )}
      refreshing={books.isRefetching}
      onRefresh={books.refetch}
    >
      {selected && selected.size > 0 && (
        <View className="flex-row gap-3">
          {canMove && (
            <View className="flex-1"><Button icon="shuffle" label={`Move ${selected.size}`} onPress={() => router.push({ pathname: '/move', params: { ids, from: id } })} /></View>
          )}
          {canArchive && (
            <View className="flex-1"><Button variant="secondary" icon="gift" label={`Give away ${selected.size}`} onPress={() => router.push({ pathname: '/donate', params: { ids } })} /></View>
          )}
        </View>
      )}

      {books.isPending && <Loading />}
      {books.error && <ErrorState error={books.error} onRetry={books.refetch} />}
      {books.data && list.length === 0 && <Empty text="📭 Nothing on this shelf yet." />}
      {selected && <Text className="text-base text-muted">Tap the books you want to move or give away.</Text>}
      {list.length > 0 && <BookGrid books={list} selected={selected} onToggle={toggle} />}

      {canAudit && list.length > 0 && !selected && (
        <Button variant="secondary" icon="check-square" label="Check this shelf" onPress={() => router.push({ pathname: '/audit', params: { shelf: id } })} />
      )}

      {canManage && shelf && !selected && (rename === null
        ? (
            <View className="flex-row gap-3">
              <View className="flex-1"><Button variant="secondary" icon="edit-3" label="Rename" onPress={() => setRename(shelf.name)} /></View>
              <View className="flex-1"><Button variant="danger" icon="trash-2" label="Delete" onPress={confirmDelete} /></View>
            </View>
          )
        : (
            <Card className="gap-3 py-4">
              <Field label="Shelf name" value={rename} onChangeText={setRename} autoFocus />
              <Button
                label="Save"
                loading={saveShelf.isPending}
                disabled={!rename.trim()}
                onPress={() => saveShelf.mutate({ libraryId: library.id, rackId: shelf.rackId, id, name: rename }, { onSuccess: () => setRename(null) })}
              />
            </Card>
          ))}
      {(saveShelf.error || deleteShelf.error) && (
        <Text className="text-center text-sm text-negative">{errorMessage(saveShelf.error ?? deleteShelf.error)}</Text>
      )}
    </Screen>
  )
}
