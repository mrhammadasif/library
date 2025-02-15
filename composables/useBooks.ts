import type { Book } from '@prisma/client'

export function useBooks(shelfId?: ComputedRef<number | undefined>) {
  const list = ref<Book[]>([])
  const loading = ref(false)

  const fetchBooks = async () => {
    if (!shelfId?.value) {
      return
    }

    loading.value = true
    try {
      list.value = await $fetch('/api/books', { query: { shelfId: shelfId.value ?? '' } })
    }
    catch (error) {
      console.error('Error fetching books:', error)
    }

    loading.value = false
  }

  const fetchISBN = async (isbn: string) => {
    try {
      isbn = isbn.replace(/-/g, '')
      const bookData = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`).then(response => response.json())
      const book = bookData[`ISBN:${isbn}`]
      return <Book>{
        title: book.title,
        author: book.authors.map((author: { name: string }) => author.name).join(', '),
        thumbnail: book.cover?.medium,
      }
    }
    catch (error) {
      console.error('Error fetching book by ISBN:', error)
      return undefined
    }
  }

  watchImmediate(() => shelfId, fetchBooks)

  return {
    list,
    loading,
    fetchBooks,
    fetchISBN,
  }
}
