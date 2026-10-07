import { Feather } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Button } from '~/components/Button'
import { Field } from '~/components/Field'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { useToast } from '~/components/Toast'
import { Colors } from '~/constants/Colors'
import { useDeleteLibrary } from '~/hooks/Libraries'
import { useMembers } from '~/hooks/Members'
import { useLibraryStats } from '~/hooks/Stats'
import { useCurrentLibrary } from '~/library/LibraryProvider'
import { errorMessage } from '~/utils/Errors'

function plural(n: number | undefined, one: string, many: string): string {
  return n === undefined ? many : `${n} ${n === 1 ? one : many}`
}

/**
 * Owner only. Spells out everything that disappears, then asks for the library's exact name (the server checks it too).
 * Deliberately slow: this is the one action in the app that can wipe a household's whole catalogue.
 */
export default function DeleteLibraryScreen() {
  const { library } = useCurrentLibrary()
  const stats = useLibraryStats(library.id)
  const members = useMembers(library.id)
  const remove = useDeleteLibrary()
  const toast = useToast()
  const [typed, setTyped] = useState('')
  const matches = typed.trim() === library.name.trim()

  const s = stats.data
  const books = s ? s.total + s.archived : undefined
  const shelves = s?.racks.reduce((n, r) => n + r.shelves.length, 0)
  const others = members.data ? members.data.length - 1 : undefined

  const losses = [
    { icon: '📚', text: `${plural(books, 'book', 'books')} and every cover photo` },
    { icon: '🗄️', text: `${plural(s?.racks.length, 'bookcase', 'bookcases')} and ${plural(shelves, 'shelf', 'shelves')}` },
    { icon: '🤝', text: `${plural(s?.loans.total, 'borrowing record', 'borrowing records')}${s?.loans.open ? ` (${s.loans.open} still out)` : ''}` },
    { icon: '✅', text: 'All book checks and history' },
    { icon: '🔑', text: 'AI keys saved for this library' },
    { icon: '👥', text: others ? `${plural(others, 'other member', 'other members')} lose access straight away` : 'All invite codes' },
  ]

  async function copyName() {
    await Clipboard.setStringAsync(library.name)
    toast('Name copied', '📋')
  }

  function deleteLibrary() {
    remove.mutate({ libraryId: library.id, confirmName: typed }, {
      onSuccess: () => {
        toast(`"${library.name}" was deleted`, '🗑️')
        router.dismissAll()
        router.replace('/')
      },
    })
  }

  return (
    <Screen header={<Header title="Delete library" subtitle={library.name} />}>
      <View className="gap-3 rounded-3xl border-2 border-negative bg-negative-soft p-5">
        <View className="flex-row items-center gap-3">
          <Feather name="alert-triangle" size={28} color={Colors.negative} />
          <Text className="flex-1 text-xl font-bold text-negative">This can't be undone</Text>
        </View>
        <Text className="text-base text-ink">
          {'Deleting '}
          <Text className="font-bold">{library.name}</Text>
          {' removes all of this immediately and for good, for everyone:'}
        </Text>
        <View className="gap-2">
          {losses.map(l => (
            <View key={l.icon} className="flex-row items-start gap-3">
              <Text className="text-lg">{l.icon}</Text>
              <Text className="flex-1 text-base text-ink">{l.text}</Text>
            </View>
          ))}
        </View>
        <Text className="text-base font-semibold text-negative">There is no undo and no way to get them back.</Text>
      </View>

      <View className="gap-3">
        <Text className="text-lg font-bold text-ink">To confirm, type the library's name</Text>
        <Pressable
          onPress={copyName}
          accessibilityRole="button"
          accessibilityLabel={`Copy the name ${library.name}`}
          className="min-h-12 flex-row items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-line bg-card px-4 py-3"
        >
          <Text className="flex-1 text-lg font-bold text-ink" selectable testID="delete-library-name">{library.name}</Text>
          <View className="flex-row items-center gap-1">
            <Feather name="copy" size={18} color={Colors.muted} />
            <Text className="text-sm font-semibold text-muted">Copy</Text>
          </View>
        </Pressable>
        <Field
          label="Library name"
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={library.name}
          testID="delete-library-confirm"
          hint={typed && !matches ? 'That doesn\'t match yet.' : undefined}
        />
      </View>

      {remove.error && <Text className="text-center text-base text-negative">{errorMessage(remove.error)}</Text>}
      <Button
        big
        variant="danger"
        icon="trash-2"
        label="Delete this library forever"
        disabled={!matches}
        loading={remove.isPending}
        onPress={deleteLibrary}
      />
      <Button variant="secondary" label="Keep my library" onPress={() => router.back()} />
    </Screen>
  )
}
