import type { IRack } from '~/models/IShelf'
import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { Empty, ErrorState, Loading } from '~/components/EmptyState'
import { Field } from '~/components/Field'
import { Screen } from '~/components/Screen'
import { Colors } from '~/constants/Colors'
import { useReorderRacks, useRacks, useSaveRack } from '~/hooks/Shelves'
import { useCan, useCurrentLibrary } from '~/library/LibraryProvider'
import { errorMessage } from '~/utils/Errors'

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export default function ShelvesScreen() {
  const { library } = useCurrentLibrary()
  const racks = useRacks(library.id)
  const canManage = useCan('shelves.manage')
  const saveRack = useSaveRack()
  const reorder = useReorderRacks(library.id)
  const [sorting, setSorting] = useState(false)
  const [newRack, setNewRack] = useState<string | null>(null)

  function shift(list: IRack[], index: number, delta: number) {
    reorder.mutate(move(list, index, index + delta).map(r => r.id))
  }

  return (
    <Screen tabs refreshing={racks.isRefetching} onRefresh={racks.refetch}>
      <View className="flex-row items-center justify-between pt-2">
        <Text className="text-3xl font-bold text-ink">Shelves</Text>
        {canManage && (racks.data?.length ?? 0) > 1 && (
          <Button small variant={sorting ? 'primary' : 'secondary'} icon="list" label={sorting ? 'Done' : 'Sort'} onPress={() => setSorting(!sorting)} />
        )}
      </View>

      {racks.isPending && <Loading />}
      {racks.error && <ErrorState error={racks.error} onRetry={racks.refetch} />}
      {racks.data?.length === 0 && (
        <Empty
          text={canManage ? 'Start by adding a rack (a bookcase), then its shelves.' : 'No shelves have been set up yet.'}
        />
      )}

      {racks.data?.map((rack, index, all) => (
        <Card key={rack.id} className="py-2">
          <Pressable
            onPress={() => router.push({ pathname: '/rack/[id]', params: { id: rack.id } })}
            className="flex-row items-center gap-3 py-2"
          >
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
              <Feather name="layers" size={18} color={Colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-ink">{rack.name}</Text>
              <Text className="text-sm text-muted">
                {rack.shelves.length} shelves · {rack.shelves.reduce((n, s) => n + s.bookCount, 0)} books
              </Text>
            </View>
            {sorting
              ? (
                  <View className="flex-row gap-1">
                    <Pressable hitSlop={6} disabled={index === 0} onPress={() => shift(all, index, -1)} className="p-2">
                      <Feather name="arrow-up" size={20} color={index === 0 ? Colors.line : Colors.ink} />
                    </Pressable>
                    <Pressable hitSlop={6} disabled={index === all.length - 1} onPress={() => shift(all, index, 1)} className="p-2">
                      <Feather name="arrow-down" size={20} color={index === all.length - 1 ? Colors.line : Colors.ink} />
                    </Pressable>
                  </View>
                )
              : <Feather name="chevron-right" size={18} color={Colors.faint} />}
          </Pressable>
          {!sorting && rack.shelves.map(shelf => (
            <Pressable
              key={shelf.id}
              onPress={() => router.push({ pathname: '/shelf/[id]', params: { id: shelf.id } })}
              className="flex-row items-center justify-between border-t border-line py-3 pl-[52px]"
            >
              <Text className="text-base text-ink">{shelf.name}</Text>
              <Text className="text-sm text-muted">{shelf.bookCount}</Text>
            </Pressable>
          ))}
        </Card>
      ))}

      {canManage && !sorting && (newRack === null
        ? <Button variant="secondary" icon="plus" label="Add a rack" onPress={() => setNewRack('')} />
        : (
            <Card className="gap-3 py-4">
              <Field label="Rack name" value={newRack} onChangeText={setNewRack} placeholder="e.g. Living room bookcase" autoFocus />
              {saveRack.error && <Text className="text-sm text-negative">{errorMessage(saveRack.error)}</Text>}
              <View className="flex-row gap-3">
                <View className="flex-1"><Button variant="secondary" label="Cancel" onPress={() => setNewRack(null)} /></View>
                <View className="flex-1">
                  <Button
                    label="Add"
                    loading={saveRack.isPending}
                    disabled={!newRack.trim()}
                    onPress={() => saveRack.mutate({ libraryId: library.id, name: newRack }, { onSuccess: () => setNewRack(null) })}
                  />
                </View>
              </View>
            </Card>
          ))}
    </Screen>
  )
}
