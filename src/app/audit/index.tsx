import type { AuditMode } from '~/models/IAudit'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { Chip } from '~/components/Chip'
import { Loading } from '~/components/EmptyState'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { SectionHeader } from '~/components/SectionHeader'
import { ShelfPicker } from '~/components/ShelfPicker'
import { useAudits, useStartAudit } from '~/hooks/Audits'
import { shelfLabels, useRacks } from '~/hooks/Shelves'
import { useCan, useCurrentLibrary } from '~/library/LibraryProvider'
import { formatDate } from '~/utils/Dates'
import { openAudit } from '~/utils/AuditNav'
import { errorMessage } from '~/utils/Errors'

const SIZES = [5, 10, 20]

function ModeCard({ selected, emoji, title, text, onPress }: { selected: boolean, emoji: string, title: string, text: string, onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`flex-row items-center gap-4 rounded-3xl border-2 p-4 ${selected ? 'border-primary bg-primary-soft' : 'border-line bg-card'}`}
    >
      <Text className="text-5xl">{emoji}</Text>
      <View className="flex-1 gap-1">
        <Text className="text-xl font-bold text-ink">{title}</Text>
        <Text className="text-base text-muted">{text}</Text>
      </View>
    </Pressable>
  )
}

export default function AuditStartScreen() {
  const params = useLocalSearchParams<{ shelf?: string }>()
  const { library } = useCurrentLibrary()
  const canAudit = useCan('audits.run')
  const racks = useRacks(library.id)
  const audits = useAudits(library.id)
  const start = useStartAudit()
  const [mode, setMode] = useState<AuditMode>(params.shelf ? 'shelf' : 'random')
  const [size, setSize] = useState(5)
  const [shelfId, setShelfId] = useState<string | null>(params.shelf ?? null)
  const labels = shelfLabels(racks.data)

  return (
    <Screen header={<Header title="Book check" subtitle="Are all the books where they should be?" />}>
      {canAudit && (
        <>
          <View className="gap-3">
            <ModeCard selected={mode === 'random'} emoji="🎲" title="Quick check" text="We pick a few books. You go and find them!" onPress={() => setMode('random')} />
            <ModeCard selected={mode === 'shelf'} emoji="🔦" title="Check a whole shelf" text="Scan every book on one shelf." onPress={() => setMode('shelf')} />
          </View>
          {mode === 'random'
            ? (
                <View className="gap-2">
                  <Text className="text-lg font-bold text-ink">How many books?</Text>
                  <View className="flex-row gap-2">
                    {SIZES.map(n => <Chip key={n} label={`${n} books`} selected={size === n} onPress={() => setSize(n)} />)}
                  </View>
                </View>
              )
            : (
                <View className="gap-2">
                  <Text className="text-lg font-bold text-ink">Which shelf?</Text>
                  {racks.data ? <ShelfPicker racks={racks.data} value={shelfId} onChange={setShelfId} /> : <Loading />}
                </View>
              )}
          {start.error && <Text className="text-center text-base text-negative">{errorMessage(start.error)}</Text>}
          <Button
            big
            label={mode === 'random' ? 'Let\'s go! 🚀' : 'Start scanning'}
            disabled={mode === 'shelf' && !shelfId}
            loading={start.isPending}
            onPress={() => start.mutate(
              { libraryId: library.id, mode, size, shelfId: shelfId ?? undefined },
              { onSuccess: id => (mode === 'random'
                ? router.replace({ pathname: '/audit/play/[id]', params: { id } })
                : router.replace({ pathname: '/audit/[id]', params: { id } })) },
            )}
          />
        </>
      )}

      {(audits.data?.length ?? 0) > 0 && (
        <View className="gap-3">
          <SectionHeader title="Earlier checks" />
          <Card>
            {audits.data!.map((audit, i, all) => {
              const found = audit.counts.found + audit.counts.misplaced
              const expected = found + audit.counts.missing + audit.counts.pending
              return (
                <Pressable
                  key={audit.id}
                  onPress={() => openAudit(audit)}
                  className={`min-h-16 gap-0.5 py-3 ${i < all.length - 1 ? 'border-b border-line' : ''}`}
                >
                  <Text className="text-lg font-semibold text-ink">
                    {audit.mode === 'shelf' ? `🔦 ${labels.get(audit.shelfId ?? '') ?? 'Shelf check'}` : `🎲 Quick check of ${audit.sampleSize}`}
                  </Text>
                  <Text className={`text-base ${audit.completedAt ? 'text-muted' : 'font-semibold text-warn'}`}>
                    {formatDate(audit.startedAt)} · {audit.completedAt ? `${found} of ${expected} found` : 'Not finished: tap to carry on'}
                    {audit.counts.missing ? ` · ${audit.counts.missing} missing` : ''}
                  </Text>
                </Pressable>
              )
            })}
          </Card>
        </View>
      )}
      {audits.isPending && <Loading />}
    </Screen>
  )
}
