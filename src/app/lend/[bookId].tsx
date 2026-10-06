import DateTimePicker from '@react-native-community/datetimepicker'
import { router, useLocalSearchParams } from 'expo-router'
import { DateTime } from 'luxon'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '~/auth/AuthProvider'
import { Avatar } from '~/components/Avatar'
import { Button } from '~/components/Button'
import { Chip } from '~/components/Chip'
import { Field } from '~/components/Field'
import { Screen } from '~/components/Screen'
import { useToast } from '~/components/Toast'
import { useBook } from '~/hooks/Books'
import { useLendBook } from '~/hooks/Loans'
import { useMembers } from '~/hooks/Members'
import { useCurrentLibrary } from '~/library/LibraryProvider'
import { errorMessage } from '~/utils/Errors'

const DUE_OPTIONS = [{ label: '1 week', days: 7 }, { label: '2 weeks', days: 14 }, { label: '1 month', days: 30 }]
const OTHER = 'other'

function Person({ name, label, selected, onPress }: { name: string, label: string, selected: boolean, onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      className={`w-24 items-center gap-1.5 rounded-2xl border-2 p-2 ${selected ? 'border-primary bg-primary-soft' : 'border-transparent'}`}
    >
      <Avatar name={name} size={60} />
      <Text className={`text-center text-sm ${selected ? 'font-bold text-primary' : 'text-ink'}`} numberOfLines={1}>{label}</Text>
    </Pressable>
  )
}

/** "Who's borrowing it?": tap a face (or "Someone else"), pick when it comes back, done. */
export default function LendScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>()
  const { library } = useCurrentLibrary()
  const { user } = useAuth()
  const toast = useToast()
  const book = useBook(library.id, bookId)
  const members = useMembers(library.id)
  const lend = useLendBook()
  const [who, setWho] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [days, setDays] = useState<number | null>(14)
  const [custom, setCustom] = useState<DateTime | null>(null)
  const [picking, setPicking] = useState(false)

  const me = members.data?.find(m => m.userId === user?.id)
  const others = (members.data ?? []).filter(m => m.userId !== user?.id)
  const due = custom ?? (days ? DateTime.now().plus({ days }).endOf('day') : null)
  const valid = who !== null && (who !== OTHER || name.trim().length > 0)
  const borrowerName = who === OTHER ? name.trim() : members.data?.find(m => m.userId === who)?.displayName ?? ''

  return (
    <Screen>
      <View className="gap-1 pt-4">
        <Text className="text-2xl font-bold text-ink">Who's borrowing it?</Text>
        <Text className="text-base text-muted" numberOfLines={1}>{book.data?.title}</Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {me && <Person name={me.displayName} label="Me" selected={who === me.userId} onPress={() => setWho(me.userId)} />}
        {others.map(m => (
          <Person key={m.userId} name={m.displayName} label={m.displayName} selected={who === m.userId} onPress={() => setWho(m.userId)} />
        ))}
        <Person name="+" label="Someone else" selected={who === OTHER} onPress={() => setWho(OTHER)} />
      </View>

      {who === OTHER && (
        <View className="gap-3">
          <Field label="Their name" value={name} onChangeText={setName} placeholder="e.g. Ali next door" autoFocus />
          <Field label="Phone number (optional)" value={contact} onChangeText={setContact} keyboardType="phone-pad" />
        </View>
      )}

      <View className="gap-3">
        <Text className="text-xl font-bold text-ink">When should it come back?</Text>
        <View className="flex-row flex-wrap gap-2">
          {DUE_OPTIONS.map(o => (
            <Chip
              key={o.days}
              label={o.label}
              selected={!custom && days === o.days}
              onPress={() => {
                setCustom(null)
                setDays(o.days)
              }}
            />
          ))}
          <Chip label="📅 Pick a day" selected={!!custom} onPress={() => setPicking(true)} />
          <Chip
            label="No rush"
            selected={!custom && days === null}
            onPress={() => {
              setCustom(null)
              setDays(null)
            }}
          />
        </View>
        {due && <Text className="text-lg text-ink">Back by {due.toFormat('cccc d LLLL')}</Text>}
        {picking && (
          <DateTimePicker
            value={(due ?? DateTime.now()).toJSDate()}
            minimumDate={new Date()}
            mode="date"
            onChange={(_e, date) => {
              setPicking(false)
              if (date) {
                setCustom(DateTime.fromJSDate(date).endOf('day'))
              }
            }}
          />
        )}
      </View>

      {lend.error && <Text className="text-center text-base text-negative">{errorMessage(lend.error)}</Text>}
      <Button
        big
        icon="book-open"
        label={who === user?.id ? 'I\'m borrowing it' : borrowerName ? `Lend to ${borrowerName}` : 'Lend it'}
        disabled={!valid}
        loading={lend.isPending}
        onPress={() => lend.mutate({
          libraryId: library.id,
          bookId,
          borrowerUserId: who === OTHER ? null : who,
          borrowerName: who === OTHER ? name : undefined,
          contact: who === OTHER ? contact : undefined,
          dueAt: due?.toISO() ?? null,
        }, {
          onSuccess: () => {
            toast(who === user?.id ? 'Enjoy the book!' : `Lent to ${borrowerName}`, '📖')
            router.back()
          },
        })}
      />
    </Screen>
  )
}
