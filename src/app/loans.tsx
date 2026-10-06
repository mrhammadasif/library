import { router } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '~/auth/AuthProvider'
import { Avatar } from '~/components/Avatar'
import { Card } from '~/components/Card'
import { Empty, ErrorState, Loading } from '~/components/EmptyState'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { useOpenLoans } from '~/hooks/Loans'
import { useCurrentLibrary } from '~/library/LibraryProvider'
import { formatDate, formatRelative, isOverdue } from '~/utils/Dates'

export default function LoansScreen() {
  const { library } = useCurrentLibrary()
  const { user } = useAuth()
  const loans = useOpenLoans(library.id)
  const list = loans.data ?? []
  return (
    <Screen header={<Header title="Borrowed books" subtitle={`${list.length} out right now`} />} refreshing={loans.isRefetching} onRefresh={loans.refetch}>
      {loans.isPending && <Loading />}
      {loans.error && <ErrorState error={loans.error} onRetry={loans.refetch} />}
      {loans.data && list.length === 0 && <Empty text="🏠 All the books are home." />}
      {list.length > 0 && (
        <Card>
          {list.map((loan, i) => {
            const late = isOverdue(loan.dueAt)
            return (
              <Pressable
                key={loan.id}
                onPress={() => router.push({ pathname: '/book/[id]', params: { id: loan.bookId } })}
                className={`min-h-20 flex-row items-center gap-3 py-3 ${i < list.length - 1 ? 'border-b border-line' : ''}`}
              >
                <Avatar name={loan.borrowerName} size={52} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-lg font-bold text-ink" numberOfLines={1}>{loan.bookTitle}</Text>
                  <Text className="text-base text-muted" numberOfLines={1}>
                    {loan.borrowerUserId === user?.id ? 'You' : loan.borrowerName}
                    {loan.borrowerContact ? ` · ${loan.borrowerContact}` : ''}
                  </Text>
                  <Text className={`text-base ${late ? 'font-bold text-negative' : 'text-muted'}`}>
                    {loan.dueAt ? `${late ? '⏰ Was due' : 'Back'} ${formatRelative(loan.dueAt)}` : `Since ${formatDate(loan.lentAt)}`}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </Card>
      )}
    </Screen>
  )
}
