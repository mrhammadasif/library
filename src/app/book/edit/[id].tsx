import type { IBookFields } from '~/models/IBook'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text } from 'react-native'
import { BookForm } from '~/components/BookForm'
import { Button } from '~/components/Button'
import { ErrorState, Loading } from '~/components/EmptyState'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { useBook, useTags, useUpdateBook } from '~/hooks/Books'
import { useCurrentLibrary } from '~/library/LibraryProvider'
import { bookToFields } from '~/utils/BookForm'
import { hexToColorName } from '~/utils/ColorName'
import { captureCover } from '~/utils/CoverPhoto'
import { errorMessage } from '~/utils/Errors'
import { dominantColor, uploadCover } from '~/utils/ImagePrep'

function EditForm({ bookId, initial }: { bookId: string, initial: IBookFields }) {
  const { library } = useCurrentLibrary()
  const tags = useTags(library.id)
  const update = useUpdateBook()
  const [fields, setFields] = useState(initial)
  const [localCover, setLocalCover] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function takeCover(source: 'camera' | 'gallery') {
    const photo = await captureCover(source)
    if (!photo) {
      return
    }
    setLocalCover(photo.uri)
    const hex = await dominantColor(photo.uri)
    if (hex) {
      setFields(current => ({ ...current, dominantColor: hex, colorName: hexToColorName(hex) }))
    }
  }

  async function save() {
    if (!fields.title.trim()) {
      setError('A title is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const coverPath = localCover ? await uploadCover(library.id, bookId, localCover) : fields.coverPath
      await update.mutateAsync({ id: bookId, fields: { ...fields, coverPath } })
      router.back()
    }
    catch (e) {
      setError(errorMessage(e))
    }
    finally {
      setSaving(false)
    }
  }

  return (
    <>
      <BookForm
        fields={fields}
        onChange={(key, value) => setFields(current => ({ ...current, [key]: value }))}
        localCoverUri={localCover}
        onTakeCover={() => takeCover('camera')}
        onPickCover={() => takeCover('gallery')}
        tagSuggestions={(tags.data ?? []).map(t => t.tag)}
      />
      {error && <Text className="text-center text-sm text-negative">{error}</Text>}
      <Button label="Save changes" icon="check" loading={saving} onPress={save} />
    </>
  )
}

export default function EditBookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const book = useBook(id)
  return (
    <Screen header={<Header title="Edit book" />}>
      {book.isPending && <Loading />}
      {book.error && <ErrorState error={book.error} onRetry={book.refetch} />}
      {book.data && <EditForm bookId={book.data.id} initial={bookToFields(book.data)} />}
    </Screen>
  )
}
