import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Button } from '~/components/Button'
import { Field } from '~/components/Field'
import { Screen } from '~/components/Screen'
import { useToast } from '~/components/Toast'
import { useArchiveBooks } from '~/hooks/Books'
import { errorMessage } from '~/utils/Errors'

const REASONS = [
  { value: 'donated', emoji: '🎁', label: 'Gave it away' },
  { value: 'lost', emoji: '😢', label: 'Lost it' },
  { value: 'discarded', emoji: '🗑️', label: 'Threw it out' },
  { value: 'other', emoji: '🤷', label: 'Something else' },
]

/** Takes books off the shelves for good (they stay in "Given away" with their history and can come back). */
export default function DonateScreen() {
  const params = useLocalSearchParams<{ ids: string }>()
  const ids = params.ids.split(',').filter(Boolean)
  const archive = useArchiveBooks()
  const toast = useToast()
  const [reason, setReason] = useState('donated')
  const [recipient, setRecipient] = useState('')
  const [note, setNote] = useState('')

  return (
    <Screen>
      <View className="gap-1 pt-4">
        <Text className="text-2xl font-bold text-ink">{ids.length > 1 ? `What happened to these ${ids.length} books?` : 'What happened to it?'}</Text>
        <Text className="text-base text-muted">It leaves the shelves, but you can always bring it back later.</Text>
      </View>
      <View className="flex-row flex-wrap gap-3">
        {REASONS.map((r) => {
          const on = reason === r.value
          return (
            <Pressable
              key={r.value}
              onPress={() => setReason(r.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              className={`min-h-24 w-[47%] items-center justify-center gap-1 rounded-2xl border-2 p-3 ${on ? 'border-primary bg-primary-soft' : 'border-line bg-card'}`}
            >
              <Text className="text-3xl">{r.emoji}</Text>
              <Text className={`text-base ${on ? 'font-bold text-primary' : 'text-ink'}`}>{r.label}</Text>
            </Pressable>
          )
        })}
      </View>
      {reason === 'donated' && <Field label="Who did you give it to?" value={recipient} onChangeText={setRecipient} placeholder="e.g. School library, cousin Sara" />}
      <Field label="Anything else? (optional)" value={note} onChangeText={setNote} multiline />
      {archive.error && <Text className="text-center text-base text-negative">{errorMessage(archive.error)}</Text>}
      <Button
        big
        icon="check"
        label="Done"
        loading={archive.isPending}
        onPress={() => archive.mutate({ bookIds: ids, reason, recipient, note }, {
          onSuccess: () => {
            toast(reason === 'donated' ? 'Thanks for sharing books!' : 'Taken off the shelves', reason === 'donated' ? '🎁' : '👍')
            router.back()
          },
        })}
      />
    </Screen>
  )
}
