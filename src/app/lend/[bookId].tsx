import DateTimePicker from '@react-native-community/datetimepicker'
import { router, useLocalSearchParams } from 'expo-router'
import { DateTime } from 'luxon'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { Button } from '~/components/Button'
import { Chip } from '~/components/Chip'
import { Field } from '~/components/Field'
import { Screen } from '~/components/Screen'
import { useAuth } from '~/auth/AuthProvider'
import { useBook } from '~/hooks/Books'
import { useLendBook } from '~/hooks/Loans'
import { useMembers } from '~/hooks/Members'
import { useCurrentLibrary } from '~/library/LibraryProvider'
import { errorMessage } from '~/utils/Errors'

const DUE_OPTIONS = [{ label: '2 weeks', days: 14 }, { label: '1 month', days: 30 }, { label: '3 months', days: 90 }]

/** Lend to a library member or to anyone else by name, with an optional due date. */
export default function LendScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>()
  const { library } = useCurrentLibrary()
  const { user } = useAuth()
  const book = useBook(bookId)
  const members = useMembers(library.id)
  const lend = useLendBook()
  const [memberId, setMemberId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [due, setDue] = useState<DateTime | null>(DateTime.now().plus({ days: 30 }).endOf('day'))
  const [picking, setPicking] = useState(false)

  const valid = memberId !== null || name.trim().length > 0
  return (
    <Screen>
      <View className="gap-1 pt-4">
        <Text className="text-2xl font-bold text-ink">Lend book</Text>
        <Text className="text-base text-muted" numberOfLines={2}>{book.data?.title}</Text>
      </View>

      {(members.data?.length ?? 0) > 1 && (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-muted">A library member</Text>
          <View className="flex-row flex-wrap gap-2">
            {members.data!.filter(m => m.userId !== user?.id).map(m => (
              <Chip
                key={m.userId}
                label={m.displayName}
                selected={memberId === m.userId}
                onPress={() => {
                  setMemberId(memberId === m.userId ? null : m.userId)
                  setName('')
                }}
              />
            ))}
          </View>
        </View>
      )}

      <Field
        label={members.data && members.data.length > 1 ? 'Or someone else' : 'Borrower'}
        value={name}
        onChangeText={(t) => {
          setName(t)
          setMemberId(null)
        }}
        placeholder="Name"
      />
      {!memberId && <Field label="Phone or note (optional)" value={contact} onChangeText={setContact} />}

      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted">Due back</Text>
        <View className="flex-row flex-wrap gap-2">
          {DUE_OPTIONS.map(o => (
            <Chip key={o.days} label={o.label} onPress={() => setDue(DateTime.now().plus({ days: o.days }).endOf('day'))} />
          ))}
          <Chip label="Pick a date" onPress={() => setPicking(true)} />
          <Chip label="No due date" selected={due === null} onPress={() => setDue(null)} />
        </View>
        {due && <Text className="text-base text-ink">{due.toFormat('cccc d LLLL yyyy')}</Text>}
        {picking && (
          <DateTimePicker
            value={(due ?? DateTime.now()).toJSDate()}
            minimumDate={new Date()}
            mode="date"
            onChange={(_e, date) => {
              setPicking(false)
              if (date) {
                setDue(DateTime.fromJSDate(date).endOf('day'))
              }
            }}
          />
        )}
      </View>

      {lend.error && <Text className="text-center text-sm text-negative">{errorMessage(lend.error)}</Text>}
      <Button
        label="Lend"
        icon="arrow-up-right"
        disabled={!valid}
        loading={lend.isPending}
        onPress={() => lend.mutate({
          bookId,
          borrowerUserId: memberId,
          borrowerName: memberId ? undefined : name,
          contact,
          dueAt: due?.toISO() ?? null,
        }, { onSuccess: () => router.back() })}
      />
    </Screen>
  )
}
