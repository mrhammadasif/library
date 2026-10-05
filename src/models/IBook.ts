import type { ColorName } from '~/constants/BookColors'

export type BookStatus = 'on_shelf' | 'borrowed' | 'missing' | 'archived'

export interface IBook {
  id: string
  libraryId: string
  isbn13: string | null
  isbn10: string | null
  title: string
  subtitle: string | null
  authors: string[]
  publisher: string | null
  publishedYear: number | null
  pages: number | null
  language: string | null
  description: string | null
  categories: string[]
  tags: string[]
  coverPath: string | null
  coverUrl: string | null
  dominantColor: string | null
  colorName: ColorName | null
  condition: string | null
  notes: string | null
  status: BookStatus
  shelfId: string | null
  archivedAt: string | null
  archiveReason: string | null
  donatedTo: string | null
  lastSeenAt: string | null
  createdAt: string
}

/** Editable fields of a book, as in the add/edit form. */
export type IBookFields = Pick<IBook, 'isbn13' | 'isbn10' | 'title' | 'subtitle' | 'authors' | 'publisher' | 'publishedYear'
  | 'pages' | 'language' | 'description' | 'categories' | 'tags' | 'coverPath' | 'coverUrl' | 'dominantColor'
  | 'colorName' | 'condition' | 'notes'>

export type BookEventType = 'created' | 'moved' | 'lent' | 'returned' | 'archived' | 'restored' | 'audited' | 'marked_missing'

export interface IBookEvent {
  id: number
  type: BookEventType
  fromShelfId: string | null
  toShelfId: string | null
  payload: Record<string, unknown>
  actorName: string | null
  at: string
}
