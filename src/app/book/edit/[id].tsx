import type { IBookFields } from '~/models/IBook'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { BookBasicsForm, BookDetailsForm } from '~/components/BookForm'
import { Button } from '~/components/Button'
import { ColorSwatches } from '~/components/ColorSwatches'
import { CoverHero } from '~/components/CoverHero'
import { ErrorState, Loading } from '~/components/EmptyState'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { useBook, useTags, useUpdateBook } from '~/hooks/Books'
import { useCurrentLibrary } from '~/library/LibraryProvider'
import { bookToFields, withNormalizedIsbn } from '~/utils/BookForm'
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

  function onChange<K extends keyof IBookFields>(key: K, value: IBookFields[K]) {
    setFields(current => ({ ...current, [key]: value }))
  }

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
    const ready = withNormalizedIsbn(fields)
    if (!ready) {
      setError('That ISBN doesn\'t look right. Fix it or clear it.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const coverPath = localCover ? await uploadCover(library.id, bookId, localCover) : fields.coverPath
      await update.mutateAsync({ libraryId: library.id, id: bookId, fields: { ...ready, coverPath } })
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
      <CoverHero
        title={fields.title}
        authors={fields.authors}
        coverPath={fields.coverPath}
        coverUrl={fields.coverUrl}
        localUri={localCover}
        color={fields.dominantColor}
        onTakeCover={() => takeCover('camera')}
        onPickCover={() => takeCover('gallery')}
      />
      <BookBasicsForm fields={fields} onChange={onChange} />
      <View className="gap-2">
        <Text className="px-1 text-sm font-semibold text-muted">Colour</Text>
        <ColorSwatches value={fields.colorName} onChange={c => onChange('colorName', c)} />
      </View>
      <BookDetailsForm fields={fields} onChange={onChange} tagSuggestions={(tags.data ?? []).map(t => t.tag)} />
      {error && <Text className="text-center text-sm text-negative">{error}</Text>}
      <Button big label="Save changes" icon="check" loading={saving} onPress={save} />
    </>
  )
}

export default function EditBookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { library } = useCurrentLibrary()
  const book = useBook(library.id, id)
  return (
    <Screen header={<Header title="Edit book" />}>
      {book.isPending && <Loading />}
      {book.error && <ErrorState error={book.error} onRetry={book.refetch} />}
      {book.data && <EditForm bookId={book.data.id} initial={bookToFields(book.data)} />}
    </Screen>
  )
}
