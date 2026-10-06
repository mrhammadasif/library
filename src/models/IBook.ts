import type { IBookDto, IBookEventDto } from '~shared/contracts/Books'

export type IBook = IBookDto
export type BookStatus = IBookDto['status']
export type IBookEvent = IBookEventDto
export type BookEventType = IBookEventDto['type']

/** Editable fields of a book, as in the add/edit form (and the API's BookFieldsInput). */
export type IBookFields = Pick<IBook, 'isbn13' | 'isbn10' | 'title' | 'subtitle' | 'authors' | 'publisher' | 'publishedYear'
  | 'pages' | 'language' | 'description' | 'categories' | 'tags' | 'coverPath' | 'coverUrl' | 'dominantColor'
  | 'colorName' | 'condition' | 'notes'>
