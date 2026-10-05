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
import { errorMessage } from '~/utils/Errors'

const SIZES = [5, 10, 20, 50]

function ModeCard({ selected, title, text, onPress }: { selected: boolean, title: string, text: string, onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={`flex-1 gap-1 rounded-2xl border-2 bg-card p-4 ${selected ? 'border-primary' : 'border-line'}`}>
      <Text className="text-base font-bold text-ink">{title}</Text>
      <Text className="text-sm text-muted">{text}</Text>
    </Pressable>
  )
}

/** Choose an audit mode (random spot-check or full shelf inventory), and see past audits. */
export default function AuditStartScreen() {
  const params = useLocalSearchParams<{ shelf?: string }>()
  const { library } = useCurrentLibrary()
  const canAudit = useCan('audits.run')
  const racks = useRacks(library.id)
  const audits = useAudits(library.id)
  const start = useStartAudit()
  const [mode, setMode] = useState<AuditMode>(params.shelf ? 'shelf' : 'random')
  const [size, setSize] = useState(10)
  const [shelfId, setShelfId] = useState<string | null>(params.shelf ?? null)
  const labels = shelfLabels(racks.data)

  return (
    <Screen header={<Header title="Audit" subtitle="Check the books are where they should be" />}>
      {canAudit && (
        <>
          <View className="flex-row gap-3">
            <ModeCard selected={mode === 'random'} title="Random check" text="A few books, favouring those not seen for longest" onPress={() => setMode('random')} />
            <ModeCard selected={mode === 'shelf'} title="Shelf inventory" text="Scan everything on one shelf and reconcile" onPress={() => setMode('shelf')} />
          </View>
          <Card className="gap-3 py-4">
            {mode === 'random'
              ? (
                  <>
                    <Text className="text-sm font-semibold text-muted">How many books?</Text>
                    <View className="flex-row gap-2">
                      {SIZES.map(n => <Chip key={n} label={String(n)} selected={size === n} onPress={() => setSize(n)} />)}
                    </View>
                  </>
                )
              : racks.data ? <ShelfPicker racks={racks.data} value={shelfId} onChange={setShelfId} /> : <Loading />}
          </Card>
          {start.error && <Text className="text-center text-sm text-negative">{errorMessage(start.error)}</Text>}
          <Button
            label="Start audit"
            icon="play"
            disabled={mode === 'shelf' && !shelfId}
            loading={start.isPending}
            onPress={() => start.mutate(
              { libraryId: library.id, mode, size, shelfId: shelfId ?? undefined },
              { onSuccess: id => router.replace({ pathname: '/audit/[id]', params: { id } }) },
            )}
          />
        </>
      )}

      <View className="gap-3">
        <SectionHeader title="Past audits" />
        {audits.isPending && <Loading />}
        {audits.data?.length === 0 && <Text className="text-sm text-muted">No audits yet.</Text>}
        {(audits.data?.length ?? 0) > 0 && (
          <Card>
            {audits.data!.map((audit, i, all) => {
              const checked = audit.counts.found + audit.counts.misplaced
              const expected = checked + audit.counts.missing + audit.counts.pending
              return (
                <Pressable
                  key={audit.id}
                  onPress={() => router.push({ pathname: '/audit/[id]', params: { id: audit.id } })}
                  className={`gap-0.5 py-3 ${i < all.length - 1 ? 'border-b border-line' : ''}`}
                >
                  <Text className="text-base font-semibold text-ink">
                    {audit.mode === 'shelf' ? labels.get(audit.shelfId ?? '') ?? 'Shelf inventory' : `Random check of ${audit.sampleSize}`}
                  </Text>
                  <Text className={`text-sm ${audit.completedAt ? 'text-muted' : 'text-warn'}`}>
                    {formatDate(audit.startedAt)} · {audit.completedAt ? `${checked}/${expected} found` : 'In progress, tap to continue'}
                    {audit.counts.missing ? ` · ${audit.counts.missing} missing` : ''}
                  </Text>
                </Pressable>
              )
            })}
          </Card>
        )}
      </View>
    </Screen>
  )
}
