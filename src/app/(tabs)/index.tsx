import { router } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { BookCover } from '~/components/BookCover'
import { Card } from '~/components/Card'
import { ErrorState, Loading } from '~/components/EmptyState'
import { IconButton } from '~/components/IconButton'
import { QuickAction } from '~/components/QuickAction'
import { Screen } from '~/components/Screen'
import { SectionHeader } from '~/components/SectionHeader'
import { StatTile } from '~/components/StatTile'
import { useRecentBooks } from '~/hooks/Books'
import { useOpenLoans } from '~/hooks/Loans'
import { useLibraryStats } from '~/hooks/Stats'
import { useCan, useCurrentLibrary } from '~/library/LibraryProvider'
import { formatRelative, isOverdue } from '~/utils/Dates'

export default function HomeScreen() {
  const { library } = useCurrentLibrary()
  const stats = useLibraryStats(library.id)
  const recent = useRecentBooks(library.id)
  const loans = useOpenLoans(library.id)
  const canAdd = useCan('books.add')
  const canAudit = useCan('audits.run')
  const overdue = (loans.data ?? []).filter(l => isOverdue(l.dueAt))

  function refresh() {
    stats.refetch()
    recent.refetch()
    loans.refetch()
  }

  return (
    <Screen tabs refreshing={stats.isRefetching} onRefresh={refresh}>
      <View className="flex-row items-center justify-between pt-2">
        <View className="flex-1">
          <Text className="text-sm text-muted">Library</Text>
          <Text className="text-3xl font-bold text-ink" numberOfLines={1}>{library.name}</Text>
        </View>
        <IconButton icon="settings" onPress={() => router.push('/settings')} />
      </View>

      <View className="flex-row gap-3">
        {canAdd && <QuickAction primary icon="maximize" label="Scan" onPress={() => router.push('/add/scan')} />}
        {canAdd && <QuickAction icon="camera" label="Cover photo" onPress={() => router.push('/add/photo')} />}
        <QuickAction icon="search" label="Search" onPress={() => router.push('/search')} />
        {canAudit && <QuickAction icon="check-square" label="Audit" onPress={() => router.push('/audit')} />}
      </View>

      {stats.isPending
        ? <Loading />
        : stats.error
          ? <ErrorState error={stats.error} onRetry={refresh} />
          : (
              <View className="flex-row gap-3">
                <StatTile label="Books" value={stats.data.total} />
                <StatTile label="Lent out" value={stats.data.by_status.borrowed ?? 0} tone={stats.data.loans.overdue ? 'warn' : 'ink'} />
                <StatTile label="Missing" value={stats.data.by_status.missing ?? 0} tone={stats.data.by_status.missing ? 'negative' : 'ink'} />
              </View>
            )}

      {(loans.data?.length ?? 0) > 0 && (
        <View className="gap-3">
          <SectionHeader title={overdue.length ? `Lent out · ${overdue.length} overdue` : 'Lent out'} action="All" onAction={() => router.push('/loans')} />
          <Card>
            {loans.data!.slice(0, 4).map((loan, i, all) => (
              <Pressable
                key={loan.id}
                onPress={() => router.push({ pathname: '/book/[id]', params: { id: loan.bookId } })}
                className={`py-3 ${i < all.length - 1 ? 'border-b border-line' : ''}`}
              >
                <Text className="text-base font-semibold text-ink" numberOfLines={1}>{loan.bookTitle}</Text>
                <Text className={`text-sm ${isOverdue(loan.dueAt) ? 'text-negative' : 'text-muted'}`}>
                  {loan.borrowerName}
                  {loan.dueAt ? ` · due ${formatRelative(loan.dueAt)}` : ''}
                </Text>
              </Pressable>
            ))}
          </Card>
        </View>
      )}

      <View className="gap-3">
        <SectionHeader title="Recently added" action="Search" onAction={() => router.push('/search')} />
        {recent.isPending
          ? <Loading />
          : recent.data?.length
            ? (
                <View className="flex-row flex-wrap gap-3">
                  {recent.data.map(book => (
                    <Pressable key={book.id} className="w-[30%] gap-1.5" onPress={() => router.push({ pathname: '/book/[id]', params: { id: book.id } })}>
                      <BookCover title={book.title} coverPath={book.coverPath} coverUrl={book.coverUrl} color={book.dominantColor} width={96} />
                      <Text className="text-xs font-medium text-ink" numberOfLines={2}>{book.title}</Text>
                    </Pressable>
                  ))}
                </View>
              )
            : (
                <Card className="gap-2 py-5">
                  <Text className="text-base font-semibold text-ink">No books yet</Text>
                  <Text className="text-sm text-muted">
                    Set up your racks and shelves in the Shelves tab, then tap the scan button to add your first book.
                  </Text>
                </Card>
              )}
      </View>
    </Screen>
  )
}
