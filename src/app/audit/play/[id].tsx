import type { AuditResult } from '~/models/IAudit'
import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { BookCover } from '~/components/BookCover'
import { Button } from '~/components/Button'
import { ErrorState, Loading } from '~/components/EmptyState'
import { Location } from '~/components/Location'
import { SafeArea } from '~/components/SafeArea'
import { ShelfPicker } from '~/components/ShelfPicker'
import { useToast } from '~/components/Toast'
import { Colors } from '~/constants/Colors'
import { useAudit, useCompleteAudit, useRecordAuditItem } from '~/hooks/Audits'
import { shelfLabels, useRacks } from '~/hooks/Shelves'
import { useCurrentLibrary } from '~/library/LibraryProvider'
import { errorMessage } from '~/utils/Errors'

/** The quick check as a game: one book at a time, three huge answers, a celebration at the end. */
export default function AuditPlayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { library } = useCurrentLibrary()
  const toast = useToast()
  const audit = useAudit(id)
  const racks = useRacks(library.id)
  const labels = shelfLabels(racks.data)
  const record = useRecordAuditItem()
  const complete = useCompleteAudit()
  const [elsewhere, setElsewhere] = useState(false)
  const [putBack, setPutBack] = useState<string | null>(null)
  // Answers apply instantly (and a double tap can't answer the same book twice) while the server catches up.
  const [answered, setAnswered] = useState<Record<string, AuditResult>>({})

  const close = (
    <Pressable
      onPress={() => router.back()}
      accessibilityLabel="Stop for now"
      className="h-12 w-12 items-center justify-center rounded-2xl border-2 border-line bg-card"
    >
      <Feather name="x" size={24} color={Colors.ink} />
    </Pressable>
  )

  if (audit.isPending || audit.error) {
    return (
      <SafeArea className="flex-1 bg-canvas p-5">
        {close}
        {audit.isPending ? <Loading /> : <ErrorState error={audit.error} onRetry={audit.refetch} />}
      </SafeArea>
    )
  }

  const items = audit.data.items
    .filter(i => i.result !== 'unexpected')
    .map(i => (answered[i.id] ? { ...i, result: answered[i.id] } : i))
  const pending = items.filter(i => i.result === 'pending')
  const current = pending[0]
  const doneCount = items.length - pending.length
  const found = items.filter(i => i.result === 'found' || i.result === 'misplaced').length
  const missing = items.filter(i => i.result === 'missing').length

  function answer(result: AuditResult, foundShelfId?: string) {
    Haptics.impactAsync(result === 'found' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    const itemId = current!.id
    setAnswered(prev => ({ ...prev, [itemId]: result }))
    record.mutate({ itemId, result, foundShelfId }, {
      // Put it back in the queue if the server didn't take the answer.
      onError: () => setAnswered(({ [itemId]: _, ...rest }) => rest),
    })
    setElsewhere(false)
    if (result === 'misplaced') {
      // Kids put it back where it belongs rather than re-homing it.
      setPutBack(current!.expectedShelfId)
    }
  }

  function finish() {
    complete.mutate(id, {
      onSuccess: () => {
        toast(missing ? 'Check saved. Keep an eye out for the missing ones!' : 'Every book is where it should be!', missing ? '🔎' : '🏆')
        router.back()
      },
    })
  }

  return (
    <SafeArea className="flex-1 bg-canvas">
      <View className="flex-row items-center gap-3 px-5 pb-3 pt-2">
        {close}
        <View className="flex-1 gap-1.5">
          <Text className="text-base font-semibold text-muted">
            {current ? `Book ${doneCount + 1} of ${items.length}` : 'All done!'}
          </Text>
          <View className="h-3 overflow-hidden rounded-full bg-line">
            <View className="h-full rounded-full bg-positive" style={{ width: `${items.length ? (doneCount / items.length) * 100 : 100}%` }} />
          </View>
        </View>
      </View>

      <ScrollView contentContainerClassName="gap-5 px-5 pb-10">
        {putBack && (
          <View className="flex-row items-center gap-3 rounded-2xl bg-warn-soft p-4">
            <Text className="text-2xl">📍</Text>
            <Text className="flex-1 text-base text-ink">Please put that one back on <Text className="font-bold">{labels.get(putBack) ?? 'its shelf'}</Text>.</Text>
            <Pressable hitSlop={10} onPress={() => setPutBack(null)} accessibilityLabel="OK"><Feather name="x" size={20} color={Colors.muted} /></Pressable>
          </View>
        )}

        {current
          ? (
              <>
                <View className="items-center gap-3 pt-2">
                  <Text className="text-2xl font-bold text-ink">Can you find this book?</Text>
                  <BookCover title={current.bookTitle ?? '?'} uri={current.coverUri} color={current.dominantColor} width={170} />
                  <View className="items-center gap-1 px-2">
                    <Text className="text-center text-2xl font-bold text-ink">{current.bookTitle}</Text>
                    {current.bookAuthors.length > 0 && <Text className="text-center text-lg text-muted">{current.bookAuthors.join(', ')}</Text>}
                  </View>
                </View>
                <Location label={labels.get(current.expectedShelfId ?? '') ?? 'its shelf'} prefix="Look on" />
                {record.error && <Text className="text-center text-base text-negative">{errorMessage(record.error)}</Text>}
                {elsewhere && racks.data
                  ? (
                      <View className="gap-3">
                        <Text className="text-xl font-bold text-ink">Where did you find it?</Text>
                        <ShelfPicker racks={racks.data} value={null} exclude={current.expectedShelfId} onChange={shelfId => answer('misplaced', shelfId)} />
                        <Button variant="secondary" label="Go back" onPress={() => setElsewhere(false)} />
                      </View>
                    )
                  : (
                      <View className="gap-3">
                        <Button big label="Found it! ✅" onPress={() => answer('found')} />
                        <Button big variant="danger" label="It's not there ❌" onPress={() => answer('missing')} />
                        <Button variant="ghost" icon="map-pin" label="It's on a different shelf" onPress={() => setElsewhere(true)} />
                      </View>
                    )}
              </>
            )
          : (
              <View className="items-center gap-4 pt-10">
                <Text className="text-8xl">{missing ? '🔎' : '🏆'}</Text>
                <Text className="text-center text-3xl font-bold text-ink">{missing ? 'Good checking!' : 'Perfect!'}</Text>
                <Text className="text-center text-xl text-muted">
                  You checked {items.length} books.{'\n'}
                  ✅ {found} found{missing ? ` · ❌ ${missing} missing` : ''}
                </Text>
                {complete.error && <Text className="text-center text-base text-negative">{errorMessage(complete.error)}</Text>}
                <View className="w-full pt-4">
                  <Button big label="Finish" icon="flag" loading={complete.isPending} onPress={finish} />
                </View>
              </View>
            )}
      </ScrollView>
    </SafeArea>
  )
}
