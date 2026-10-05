import type { IShelf } from '~/models/IShelf'
import { Feather } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { Empty, Loading } from '~/components/EmptyState'
import { Field } from '~/components/Field'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { Colors } from '~/constants/Colors'
import { useDeleteRack, useRacks, useReorderShelves, useSaveRack, useSaveShelf } from '~/hooks/Shelves'
import { useCan, useCurrentLibrary } from '~/library/LibraryProvider'
import { errorMessage } from '~/utils/Errors'

/** A rack's shelves: open, add, rename the rack, and sort shelves top-to-bottom. */
export default function RackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { library } = useCurrentLibrary()
  const racks = useRacks(library.id)
  const canManage = useCan('shelves.manage')
  const saveRack = useSaveRack()
  const deleteRack = useDeleteRack()
  const saveShelf = useSaveShelf()
  const reorder = useReorderShelves(library.id)
  const [newShelf, setNewShelf] = useState<string | null>(null)
  const [rename, setRename] = useState<string | null>(null)
  const rack = racks.data?.find(r => r.id === id)

  if (!rack) {
    return <Screen header={<Header title="Rack" />}>{racks.isPending ? <Loading /> : <Empty text="This rack was deleted." />}</Screen>
  }

  function shift(shelves: IShelf[], index: number, delta: number) {
    const next = [...shelves]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    reorder.mutate({ rackId: rack!.id, ids: next.map(s => s.id) })
  }

  function confirmDelete() {
    Alert.alert(`Delete "${rack!.name}"?`, 'Its shelves are deleted too. Racks with books on them can\'t be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteRack.mutate(rack!.id, { onSuccess: () => router.back() }) },
    ])
  }

  const error = saveRack.error ?? deleteRack.error ?? saveShelf.error ?? reorder.error
  return (
    <Screen header={<Header title={rack.name} subtitle={rack.notes ?? `${rack.shelves.length} shelves`} />}>
      {rack.shelves.length === 0 && <Empty text="No shelves in this rack yet." />}
      {rack.shelves.length > 0 && (
        <Card>
          {rack.shelves.map((shelf, index, all) => (
            <View key={shelf.id} className={`flex-row items-center gap-2 py-3 ${index < all.length - 1 ? 'border-b border-line' : ''}`}>
              <Pressable className="flex-1" onPress={() => router.push({ pathname: '/shelf/[id]', params: { id: shelf.id } })}>
                <Text className="text-base font-semibold text-ink">{shelf.name}</Text>
                <Text className="text-sm text-muted">{shelf.bookCount} books</Text>
              </Pressable>
              {canManage && (
                <>
                  <Pressable hitSlop={6} disabled={index === 0} onPress={() => shift(all, index, -1)} className="p-2">
                    <Feather name="arrow-up" size={20} color={index === 0 ? Colors.line : Colors.ink} />
                  </Pressable>
                  <Pressable hitSlop={6} disabled={index === all.length - 1} onPress={() => shift(all, index, 1)} className="p-2">
                    <Feather name="arrow-down" size={20} color={index === all.length - 1 ? Colors.line : Colors.ink} />
                  </Pressable>
                </>
              )}
            </View>
          ))}
        </Card>
      )}

      {canManage && (newShelf === null
        ? <Button icon="plus" label="Add a shelf" onPress={() => setNewShelf(`Shelf ${rack.shelves.length + 1}`)} />
        : (
            <Card className="gap-3 py-4">
              <Field label="Shelf name" value={newShelf} onChangeText={setNewShelf} autoFocus selectTextOnFocus />
              <View className="flex-row gap-3">
                <View className="flex-1"><Button variant="secondary" label="Cancel" onPress={() => setNewShelf(null)} /></View>
                <View className="flex-1">
                  <Button
                    label="Add"
                    loading={saveShelf.isPending}
                    disabled={!newShelf.trim()}
                    onPress={() => saveShelf.mutate({ libraryId: library.id, rackId: rack.id, name: newShelf }, { onSuccess: () => setNewShelf(null) })}
                  />
                </View>
              </View>
            </Card>
          ))}

      {canManage && (rename === null
        ? (
            <View className="flex-row gap-3">
              <View className="flex-1"><Button variant="secondary" icon="edit-3" label="Rename rack" onPress={() => setRename(rack.name)} /></View>
              <View className="flex-1"><Button variant="danger" icon="trash-2" label="Delete rack" onPress={confirmDelete} /></View>
            </View>
          )
        : (
            <Card className="gap-3 py-4">
              <Field label="Rack name" value={rename} onChangeText={setRename} autoFocus />
              <Button
                label="Save"
                loading={saveRack.isPending}
                disabled={!rename.trim()}
                onPress={() => saveRack.mutate({ libraryId: library.id, id: rack.id, name: rename, notes: rack.notes }, { onSuccess: () => setRename(null) })}
              />
            </Card>
          ))}
      {error && <Text className="text-center text-sm text-negative">{errorMessage(error)}</Text>}
    </Screen>
  )
}
