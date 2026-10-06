import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useAuth } from '~/auth/AuthProvider'
import { ActionTile } from '~/components/ActionTile'
import { Avatar } from '~/components/Avatar'
import { BookTile } from '~/components/BookTile'
import { Card } from '~/components/Card'
import { ErrorState } from '~/components/EmptyState'
import { Screen } from '~/components/Screen'
import { SectionHeader } from '~/components/SectionHeader'
import { Colors } from '~/constants/Colors'
import { useRecentBooks } from '~/hooks/Books'
import { useOpenLoans } from '~/hooks/Loans'
import { useProfile } from '~/hooks/Members'
import { useRacks } from '~/hooks/Shelves'
import { useLibraryStats } from '~/hooks/Stats'
import { useCan, useCurrentLibrary } from '~/library/LibraryProvider'
import { formatRelative, isOverdue } from '~/utils/Dates'

function SetupStep({ n, done, title, text, onPress }: { n: number, done: boolean, title: string, text: string, onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={done || !onPress}
      accessibilityRole="button"
      accessibilityState={{ checked: done, disabled: done || !onPress }}
      className={`flex-row items-center gap-4 rounded-2xl border-2 p-4 ${done ? 'border-line bg-canvas' : 'border-primary bg-card'}`}
    >
      <View className={`h-11 w-11 items-center justify-center rounded-full ${done ? 'bg-positive' : 'bg-primary'}`}>
        {done ? <Feather name="check" size={22} color="#fff" /> : <Text className="text-lg font-bold text-white">{n}</Text>}
      </View>
      <View className="flex-1">
        <Text className={`text-lg font-bold ${done ? 'text-muted line-through' : 'text-ink'}`}>{title}</Text>
        {!done && <Text className="text-sm text-muted">{text}</Text>}
      </View>
      {!done && onPress && <Feather name="chevron-right" size={22} color={Colors.primary} />}
    </Pressable>
  )
}

export default function HomeScreen() {
  const { user } = useAuth()
  const { library } = useCurrentLibrary()
  const profile = useProfile(user?.id)
  const stats = useLibraryStats(library.id)
  const recent = useRecentBooks(library.id, 12)
  const loans = useOpenLoans(library.id)
  const racks = useRacks(library.id)
  const canAudit = useCan('audits.run')
  const canShelves = useCan('shelves.manage')
  const canAdd = useCan('books.add')
  const coverWidth = 104

  const overdue = (loans.data ?? []).filter(l => isOverdue(l.dueAt))
  const firstName = profile.data?.display_name.split(' ')[0]
  const hasRack = (racks.data?.length ?? 0) > 0
  const hasShelf = racks.data?.some(r => r.shelves.length > 0) ?? false
  const hasBook = (stats.data?.total ?? 0) + (stats.data?.archived ?? 0) > 0
  const showSetup = racks.data && stats.data && !hasBook && (canShelves || canAdd)

  function refresh() {
    stats.refetch()
    recent.refetch()
    loans.refetch()
    racks.refetch()
  }

  return (
    <Screen tabs refreshing={stats.isRefetching} onRefresh={refresh}>
      <View className="flex-row items-center justify-between pt-3">
        <Pressable className="flex-1" onPress={() => router.push('/settings')} accessibilityLabel={`${library.name}. Switch library`}>
          <Text className="text-lg text-muted">{firstName ? `Hi ${firstName} 👋` : 'Hi 👋'}</Text>
          <View className="flex-row items-center gap-1">
            <Text className="shrink text-3xl font-bold text-ink" numberOfLines={1}>{library.name}</Text>
            <Feather name="chevron-down" size={22} color={Colors.muted} />
          </View>
        </Pressable>
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          className="h-14 w-14 items-center justify-center rounded-2xl border-2 border-line bg-card"
        >
          <Feather name="settings" size={24} color={Colors.ink} />
        </Pressable>
      </View>

      {stats.error && <ErrorState error={stats.error} onRetry={refresh} />}

      {showSetup
        ? (
            <Card className="gap-3 py-5">
              <Text className="text-2xl font-bold text-ink">Let's set up your library 📚</Text>
              <Text className="text-base text-muted">Three quick steps, then you can scan books in seconds.</Text>
              <SetupStep n={1} done={hasRack} title="Add a bookcase" text="Like “Living room” or “Kids room”" onPress={canShelves ? () => router.push('/shelves') : undefined} />
              <SetupStep n={2} done={hasShelf} title="Add its shelves" text="Top, middle, bottom…" onPress={canShelves && hasRack ? () => router.push({ pathname: '/rack/[id]', params: { id: racks.data![0].id } }) : undefined} />
              <SetupStep n={3} done={hasBook} title="Scan your first book" text="Point the camera at the barcode on the back" onPress={canAdd && hasShelf ? () => router.push('/add/scan') : undefined} />
            </Card>
          )
        : (
            <View className="gap-3">
              <View className="flex-row gap-3">
                <ActionTile emoji="📷" label="Scan a book" hint="Add it or see where it goes" tint="#DCEBE3" onPress={() => router.push('/add/scan')} />
                <ActionTile emoji="🔍" label="Find a book" hint="By name, colour or photo" tint="#DCE6F5" onPress={() => router.push('/search')} />
              </View>
              <View className="flex-row gap-3">
                <ActionTile
                  emoji="📖"
                  label="Borrowed"
                  hint={loans.data?.length ? `${loans.data.length} out now` : 'Nothing out'}
                  tint="#F7EBCB"
                  badge={overdue.length}
                  onPress={() => router.push('/loans')}
                />
                {canAudit
                  ? <ActionTile emoji="✅" label="Book check" hint="Are they all there?" tint="#F6DED6" onPress={() => router.push('/audit')} />
                  : <ActionTile emoji="📚" label="Shelves" hint={`${stats.data?.total ?? 0} books`} tint="#F6DED6" onPress={() => router.push('/shelves')} />}
              </View>
            </View>
          )}

      {overdue.length > 0 && (
        <Pressable onPress={() => router.push('/loans')} className="flex-row items-center gap-3 rounded-2xl bg-negative-soft p-4">
          <Text className="text-3xl">⏰</Text>
          <Text className="flex-1 text-base font-semibold text-negative">
            {overdue.length === 1 ? '1 book should be back by now' : `${overdue.length} books should be back by now`}
          </Text>
          <Feather name="chevron-right" size={22} color={Colors.negative} />
        </Pressable>
      )}

      {(loans.data?.length ?? 0) > 0 && (
        <View className="gap-3">
          <SectionHeader title="Borrowed right now" action="See all" onAction={() => router.push('/loans')} />
          <Card>
            {loans.data!.slice(0, 3).map((loan, i, all) => (
              <Pressable
                key={loan.id}
                onPress={() => router.push({ pathname: '/book/[id]', params: { id: loan.bookId } })}
                className={`flex-row items-center gap-3 py-3 ${i < all.length - 1 ? 'border-b border-line' : ''}`}
              >
                <Avatar name={loan.borrowerName} size={44} />
                <View className="flex-1">
                  <Text className="text-base font-bold text-ink" numberOfLines={1}>{loan.bookTitle}</Text>
                  <Text className={`text-sm ${isOverdue(loan.dueAt) ? 'font-semibold text-negative' : 'text-muted'}`}>
                    {loan.borrowerName}
                    {loan.dueAt ? ` · back ${formatRelative(loan.dueAt)}` : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
          </Card>
        </View>
      )}

      {(recent.data?.length ?? 0) > 0 && (
        <View className="gap-3">
          <SectionHeader title="New on the shelves" action="See all" onAction={() => router.push('/search')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3.5 pr-5" className="-mr-5">
            {recent.data!.map(book => <BookTile key={book.id} book={book} width={coverWidth} />)}
          </ScrollView>
        </View>
      )}

      {stats.data && hasBook && (
        <Pressable onPress={() => router.push('/reports')} className="flex-row items-center justify-center gap-2 py-2">
          <Text className="text-base text-muted">
            📚 {stats.data.total} books · ✍️ {stats.data.authors} authors
          </Text>
        </Pressable>
      )}
    </Screen>
  )
}
