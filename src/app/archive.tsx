import { Card } from '~/components/Card'
import { BookRow } from '~/components/BookRow'
import { Empty, ErrorState, Loading } from '~/components/EmptyState'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { useArchivedBooks } from '~/hooks/Books'
import { useCurrentLibrary } from '~/library/LibraryProvider'
import { formatDate } from '~/utils/Dates'

export default function ArchiveScreen() {
  const { library } = useCurrentLibrary()
  const books = useArchivedBooks(library.id)
  const list = books.data ?? []
  return (
    <Screen header={<Header title="Archive" subtitle="Donated, lost and discarded books" />} refreshing={books.isRefetching} onRefresh={books.refetch}>
      {books.isPending && <Loading />}
      {books.error && <ErrorState error={books.error} onRetry={books.refetch} />}
      {books.data && list.length === 0 && <Empty text="The archive is empty." />}
      {list.length > 0 && (
        <Card>
          {list.map((book, i) => (
            <BookRow
              key={book.id}
              book={book}
              last={i === list.length - 1}
              shelfLabel={`${book.donatedTo ? `To ${book.donatedTo}` : book.archiveReason ?? ''} · ${formatDate(book.archivedAt)}`}
            />
          ))}
        </Card>
      )}
    </Screen>
  )
}
