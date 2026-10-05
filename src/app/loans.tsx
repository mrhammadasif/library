import { router } from 'expo-router'
import { Pressable, Text } from 'react-native'
import { Card } from '~/components/Card'
import { Empty, ErrorState, Loading } from '~/components/EmptyState'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { useOpenLoans } from '~/hooks/Loans'
import { useCurrentLibrary } from '~/library/LibraryProvider'
import { formatDate, formatRelative, isOverdue } from '~/utils/Dates'

export default function LoansScreen() {
  const { library } = useCurrentLibrary()
  const loans = useOpenLoans(library.id)
  const list = loans.data ?? []
  return (
    <Screen header={<Header title="Lent out" subtitle={`${list.length} books`} />} refreshing={loans.isRefetching} onRefresh={loans.refetch}>
      {loans.isPending && <Loading />}
      {loans.error && <ErrorState error={loans.error} onRetry={loans.refetch} />}
      {loans.data && list.length === 0 && <Empty text="Nothing is lent out." />}
      {list.length > 0 && (
        <Card>
          {list.map((loan, i) => (
            <Pressable
              key={loan.id}
              onPress={() => router.push({ pathname: '/book/[id]', params: { id: loan.bookId } })}
              className={`gap-0.5 py-3 ${i < list.length - 1 ? 'border-b border-line' : ''}`}
            >
              <Text className="text-base font-semibold text-ink" numberOfLines={1}>{loan.bookTitle}</Text>
              <Text className="text-sm text-muted">
                {loan.borrowerName}
                {loan.borrowerContact ? ` · ${loan.borrowerContact}` : ''}
                {` · since ${formatDate(loan.lentAt)}`}
              </Text>
              {loan.dueAt && (
                <Text className={`text-sm ${isOverdue(loan.dueAt) ? 'font-semibold text-negative' : 'text-muted'}`}>
                  {isOverdue(loan.dueAt) ? 'Overdue, was due ' : 'Due '}
                  {formatRelative(loan.dueAt)}
                </Text>
              )}
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  )
}
