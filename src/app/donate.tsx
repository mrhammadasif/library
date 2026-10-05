import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { Button } from '~/components/Button'
import { Chip } from '~/components/Chip'
import { Field } from '~/components/Field'
import { Screen } from '~/components/Screen'
import { useArchiveBooks } from '~/hooks/Books'
import { errorMessage } from '~/utils/Errors'

const REASONS = [
  { value: 'donated', label: 'Donated' },
  { value: 'lost', label: 'Lost' },
  { value: 'discarded', label: 'Discarded' },
  { value: 'other', label: 'Other' },
]

/** Moves books to the archive: off their shelves, history kept, restorable later. */
export default function DonateScreen() {
  const params = useLocalSearchParams<{ ids: string }>()
  const ids = params.ids.split(',').filter(Boolean)
  const archive = useArchiveBooks()
  const [reason, setReason] = useState('donated')
  const [recipient, setRecipient] = useState('')
  const [note, setNote] = useState('')

  return (
    <Screen>
      <View className="gap-1 pt-4">
        <Text className="text-2xl font-bold text-ink">{ids.length > 1 ? `Archive ${ids.length} books` : 'Donate or archive'}</Text>
        <Text className="text-base text-muted">The books leave their shelves but stay in the archive with their history.</Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {REASONS.map(r => <Chip key={r.value} label={r.label} selected={reason === r.value} onPress={() => setReason(r.value)} />)}
      </View>
      {reason === 'donated' && <Field label="Donated to" value={recipient} onChangeText={setRecipient} placeholder="e.g. School library, Ali" />}
      <Field label="Note (optional)" value={note} onChangeText={setNote} multiline />
      {archive.error && <Text className="text-center text-sm text-negative">{errorMessage(archive.error)}</Text>}
      <Button
        label={reason === 'donated' ? 'Donate' : 'Archive'}
        icon="gift"
        loading={archive.isPending}
        onPress={() => archive.mutate({ bookIds: ids, reason, recipient, note }, { onSuccess: () => router.back() })}
      />
    </Screen>
  )
}
