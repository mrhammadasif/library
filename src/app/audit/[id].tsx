import type { AuditResult, IAuditItem } from '~/models/IAudit'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { BarcodeScanner } from '~/components/BarcodeScanner'
import { BookCover } from '~/components/BookCover'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { ErrorState, Loading } from '~/components/EmptyState'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { ShelfPicker } from '~/components/ShelfPicker'
import { useAudit, useCompleteAudit, useRecordAuditItem, useRecordAuditScan } from '~/hooks/Audits'
import { shelfLabels, useRacks } from '~/hooks/Shelves'
import { useCan, useCurrentLibrary } from '~/library/LibraryProvider'
import { Colors } from '~/constants/Colors'
import { errorMessage } from '~/utils/Errors'

const RESULT_LABEL: Record<AuditResult, { text: string, className: string }> = {
  pending: { text: 'Not checked yet', className: 'text-faint' },
  found: { text: 'Found', className: 'text-positive' },
  missing: { text: 'Missing', className: 'text-negative' },
  misplaced: { text: 'On another shelf', className: 'text-warn' },
  unexpected: { text: 'Doesn\'t belong here', className: 'text-warn' },
}

function ItemCard({ item, shelfName, open, onRecord, canMove, misplacing, setMisplacing }: {
  item: IAuditItem
  shelfName: (id: string | null) => string
  open: boolean
  onRecord: (result: AuditResult, foundShelfId?: string, move?: boolean) => void
  canMove: boolean
  misplacing: boolean
  setMisplacing: (on: boolean) => void
}) {
  const { library } = useCurrentLibrary()
  const racks = useRacks(library.id)
  const [move, setMove] = useState(canMove)
  const label = RESULT_LABEL[item.result]
  return (
    <Card className="gap-3 py-3">
      <View className="flex-row gap-3">
        <BookCover title={item.bookTitle ?? item.scannedIsbn ?? '?'} uri={item.coverUri} color={item.dominantColor} width={44} />
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold text-ink" numberOfLines={2}>{item.bookTitle ?? `Unknown ISBN ${item.scannedIsbn}`}</Text>
          <Text className="text-xs text-muted">Should be on {shelfName(item.expectedShelfId)}</Text>
          <Text className={`text-xs font-semibold ${label.className}`}>
            {label.text}
            {(item.result === 'misplaced' || item.result === 'unexpected') && item.foundShelfId ? ` (found on ${shelfName(item.foundShelfId)})` : ''}
          </Text>
        </View>
      </View>
      {open && !misplacing && (
        <View className="flex-row gap-2">
          <View className="flex-1"><Button small label="Found" icon="check" onPress={() => onRecord('found')} /></View>
          <View className="flex-1"><Button small variant="danger" label="Missing" onPress={() => onRecord('missing')} /></View>
          <View className="flex-1"><Button small variant="secondary" label="Other shelf" onPress={() => setMisplacing(true)} /></View>
        </View>
      )}
      {open && misplacing && racks.data && (
        <View className="gap-3">
          <Text className="text-sm font-semibold text-muted">Which shelf was it on?</Text>
          <ShelfPicker racks={racks.data} value={null} exclude={item.expectedShelfId} onChange={shelfId => onRecord('misplaced', shelfId, canMove && move)} />
          {canMove && (
            <Button small variant="ghost" icon={move ? 'check-square' : 'square'} label="Make that its new home shelf" onPress={() => setMove(!move)} />
          )}
          <Button small variant="secondary" label="Cancel" onPress={() => setMisplacing(false)} />
        </View>
      )}
    </Card>
  )
}

/** Runs an audit: tap Found / Missing / Elsewhere per book, or (shelf mode) scan every barcode on the shelf. */
export default function AuditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { library } = useCurrentLibrary()
  const audit = useAudit(library.id, id)
  const racks = useRacks(library.id)
  const labels = shelfLabels(racks.data)
  const record = useRecordAuditItem(library.id)
  const scan = useRecordAuditScan(library.id)
  const complete = useCompleteAudit(library.id)
  const canMove = useCan('books.move')
  const canAudit = useCan('audits.run')
  const [scanning, setScanning] = useState(false)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const [misplacingId, setMisplacingId] = useState<string | null>(null)

  if (audit.isPending) {
    return <Screen header={<Header title="Audit" />}><Loading /></Screen>
  }
  if (audit.error) {
    return <Screen header={<Header title="Audit" />}><ErrorState error={audit.error} onRetry={audit.refetch} /></Screen>
  }
  const { audit: a, items } = audit.data
  const open = !a.completedAt && canAudit
  const shelfName = (shelfId: string | null) => (shelfId ? labels.get(shelfId) ?? 'a removed shelf' : 'no shelf')
  const expected = items.filter(i => i.result !== 'unexpected')
  const done = expected.filter(i => i.result !== 'pending').length
  const pending = items.filter(i => i.result === 'pending')
  const others = items.filter(i => i.result !== 'pending')
  const error = record.error ?? scan.error ?? complete.error

  function onIsbn(isbn: string) {
    scan.mutate({ auditId: id, isbn }, {
      onSuccess: (r) => {
        const title = items.find(i => i.id === r.itemId)?.bookTitle
        setLastScan(r.result === 'found'
          ? `✅ ${title ?? isbn}${r.already ? ' (already counted)' : ''}`
          : r.bookId ? '📍 That one belongs on another shelf' : '🤔 That book isn\'t in the library')
      },
    })
  }

  return (
    <Screen
      header={(
        <Header
          title={a.mode === 'shelf' ? `🔦 ${shelfName(a.shelfId)}` : '🎲 Quick check'}
          subtitle={a.completedAt ? 'Finished' : `${done} of ${expected.length} checked`}
        />
      )}
    >
      <View className="h-2 overflow-hidden rounded-full bg-line">
        <View className="h-full rounded-full bg-primary" style={{ width: `${expected.length ? (done / expected.length) * 100 : 0}%` }} />
      </View>

      {a.completedAt && (
        <Card className="gap-1 py-4">
          <Text className="text-xl font-bold text-ink">Check finished 🎉</Text>
          <Text className="text-base text-muted">
            {a.counts.found} found · {a.counts.misplaced} on the wrong shelf · {a.counts.missing} missing
            {a.counts.unexpected ? ` · ${a.counts.unexpected} unexpected` : ''}
          </Text>
        </Card>
      )}

      {open && a.mode === 'shelf' && (
        scanning
          ? (
              <View className="gap-2">
                <View className="h-72 overflow-hidden rounded-3xl">
                  <BarcodeScanner onIsbn={onIsbn} paused={scan.isPending} hint="Scan each book on the shelf" />
                </View>
                {lastScan && <Text className="text-center text-xl font-bold text-ink">{lastScan}</Text>}
                <Button small variant="secondary" label="Stop scanning" onPress={() => setScanning(false)} />
              </View>
            )
          : <Button big icon="maximize" label="Scan the books on this shelf" onPress={() => setScanning(true)} />
      )}

      {error && <Text className="text-center text-sm text-negative">{errorMessage(error)}</Text>}

      {pending.length > 0 && (
        <View className="gap-3">
          <Text className="text-lg font-bold text-ink">Still to find ({pending.length})</Text>
          {pending.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              shelfName={shelfName}
              open={open}
              canMove={canMove}
              misplacing={misplacingId === item.id}
              setMisplacing={on => setMisplacingId(on ? item.id : null)}
              onRecord={(result, foundShelfId, move) => {
                setMisplacingId(null)
                record.mutate({ itemId: item.id, result, foundShelfId, move })
              }}
            />
          ))}
        </View>
      )}

      {others.length > 0 && (
        <View className="gap-3">
          <Text className="text-lg font-bold text-ink">Checked ({others.length})</Text>
          {others.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              shelfName={shelfName}
              open={false}
              canMove={canMove}
              misplacing={false}
              setMisplacing={() => {}}
              onRecord={() => {}}
            />
          ))}
        </View>
      )}

      {open && (
        <View className="gap-2">
          {pending.length > 0 && (
            <Text className="text-center text-sm" style={{ color: Colors.muted }}>
              Finishing marks the {pending.length} books you didn't find as missing.
            </Text>
          )}
          <Button label="Finish check" icon="flag" loading={complete.isPending} onPress={() => complete.mutate(id)} />
        </View>
      )}
    </Screen>
  )
}
