import type { IBook } from '~/models/IBook'
import type { IRack } from '~/models/IShelf'
import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { BookTile } from '~/components/BookTile'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { Empty, ErrorState, Loading } from '~/components/EmptyState'
import { Field } from '~/components/Field'
import { Screen } from '~/components/Screen'
import { Colors } from '~/constants/Colors'
import { useBooksByShelf } from '~/hooks/Books'
import { useRacks, useReorderRacks, useSaveRack } from '~/hooks/Shelves'
import { useCan, useCurrentLibrary } from '~/library/LibraryProvider'
import { errorMessage } from '~/utils/Errors'

const SPINE = 58

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** One shelf drawn like the real thing: covers standing on a plank. */
function ShelfRow({ shelfId, name, books }: { shelfId: string, name: string, books: IBook[] }) {
  const open = () => router.push({ pathname: '/shelf/[id]', params: { id: shelfId } })
  return (
    <View className="gap-2">
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${name}, ${books.length} books`} className="min-h-10 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-ink">{name}</Text>
        <View className="flex-row items-center gap-1">
          <Text className="text-base text-muted">{books.length}</Text>
          <Feather name="chevron-right" size={20} color={Colors.faint} />
        </View>
      </Pressable>
      {books.length > 0
        ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-end gap-1.5 px-1">
              {books.slice(0, 30).map(book => <BookTile key={book.id} book={book} width={SPINE} showTitle={false} />)}
              {books.length > 30 && (
                <Pressable onPress={open} className="h-[87px] w-[58px] items-center justify-center rounded-md bg-primary-soft">
                  <Text className="text-base font-bold text-primary">+{books.length - 30}</Text>
                </Pressable>
              )}
            </ScrollView>
          )
        : (
            <Pressable onPress={open} className="h-16 items-center justify-center rounded-xl border-2 border-dashed border-line">
              <Text className="text-base text-faint">Empty shelf</Text>
            </Pressable>
          )}
      <View className="h-2 rounded-full bg-[#C9B79C]" />
    </View>
  )
}

export default function ShelvesScreen() {
  const { library } = useCurrentLibrary()
  const racks = useRacks(library.id)
  const books = useBooksByShelf(library.id)
  const canManage = useCan('shelves.manage')
  const saveRack = useSaveRack()
  const reorder = useReorderRacks(library.id)
  const [editing, setEditing] = useState(false)
  const [newRack, setNewRack] = useState<string | null>(null)

  function shift(list: IRack[], index: number, delta: number) {
    reorder.mutate(move(list, index, index + delta).map(r => r.id))
  }

  const empty = racks.data?.length === 0
  return (
    <Screen
      tabs
      refreshing={racks.isRefetching}
      onRefresh={() => {
        racks.refetch()
        books.refetch()
      }}
    >
      <View className="flex-row items-center justify-between pt-3">
        <Text className="text-3xl font-bold text-ink">Shelves</Text>
        {canManage && !empty && (
          <Button small variant={editing ? 'primary' : 'secondary'} icon={editing ? 'check' : 'edit-3'} label={editing ? 'Done' : 'Change'} onPress={() => setEditing(!editing)} />
        )}
      </View>

      {racks.isPending && <Loading />}
      {racks.error && <ErrorState error={racks.error} onRetry={racks.refetch} />}
      {empty && (
        <Empty text={canManage ? '📚 Add your first bookcase. A bookcase holds shelves, and shelves hold books.' : 'No bookcases yet.'} />
      )}

      {racks.data?.map((rack, index, all) => (
        <Card key={rack.id} className="gap-4 py-4">
          <View className="flex-row items-center gap-3">
            <Text className="text-2xl">📚</Text>
            <Text className="flex-1 text-xl font-bold text-ink" numberOfLines={1}>{rack.name}</Text>
            {editing
              ? (
                  <View className="flex-row gap-1">
                    <Pressable accessibilityLabel="Move up" hitSlop={6} disabled={index === 0} onPress={() => shift(all, index, -1)} className="h-11 w-11 items-center justify-center">
                      <Feather name="arrow-up" size={24} color={index === 0 ? Colors.line : Colors.ink} />
                    </Pressable>
                    <Pressable accessibilityLabel="Move down" hitSlop={6} disabled={index === all.length - 1} onPress={() => shift(all, index, 1)} className="h-11 w-11 items-center justify-center">
                      <Feather name="arrow-down" size={24} color={index === all.length - 1 ? Colors.line : Colors.ink} />
                    </Pressable>
                    <Pressable accessibilityLabel={`Change ${rack.name}`} onPress={() => router.push({ pathname: '/rack/[id]', params: { id: rack.id } })} className="h-11 w-11 items-center justify-center">
                      <Feather name="settings" size={22} color={Colors.primary} />
                    </Pressable>
                  </View>
                )
              : null}
          </View>
          {!editing && rack.shelves.map(shelf => (
            <ShelfRow key={shelf.id} shelfId={shelf.id} name={shelf.name} books={books.data?.get(shelf.id) ?? []} />
          ))}
          {!editing && rack.shelves.length === 0 && (
            canManage
              ? <Button variant="secondary" icon="plus" label="Add shelves" onPress={() => router.push({ pathname: '/rack/[id]', params: { id: rack.id } })} />
              : <Text className="text-base text-muted">No shelves yet.</Text>
          )}
          {editing && <Text className="text-base text-muted">{rack.shelves.length} shelves. Tap ⚙️ to rename, add or sort shelves.</Text>}
        </Card>
      ))}

      {canManage && (editing || empty) && (newRack === null
        ? <Button big={empty} variant={empty ? 'primary' : 'secondary'} icon="plus" label="Add a bookcase" onPress={() => setNewRack('')} />
        : (
            <Card className="gap-3 py-4">
              <Field testID="bookcase-name" label="What's the bookcase called?" value={newRack} onChangeText={setNewRack} placeholder="e.g. Living room, Kids room" autoFocus />
              {saveRack.error && <Text className="text-sm text-negative">{errorMessage(saveRack.error)}</Text>}
              <View className="flex-row gap-3">
                <View className="flex-1"><Button variant="secondary" label="Cancel" onPress={() => setNewRack(null)} /></View>
                <View className="flex-1">
                  <Button
                    label="Add"
                    loading={saveRack.isPending}
                    disabled={!newRack.trim()}
                    onPress={() => saveRack.mutate({ libraryId: library.id, name: newRack }, {
                      onSuccess: (id) => {
                        setNewRack(null)
                        setEditing(false)
                        // A new bookcase is useless without shelves: go straight there.
                        router.push({ pathname: '/rack/[id]', params: { id, isNew: '1' } })
                      },
                    })}
                  />
                </View>
              </View>
            </Card>
          ))}
    </Screen>
  )
}
