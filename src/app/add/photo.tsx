import type { IBookDraft, IIdentification } from '~/models/IBookDraft'
import { Feather } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { BookCover } from '~/components/BookCover'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { Loading } from '~/components/EmptyState'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { Colors } from '~/constants/Colors'
import { identifyCover } from '~/hooks/Lookup'
import { useCan, useCurrentLibrary } from '~/library/LibraryProvider'
import { captureCover } from '~/utils/CoverPhoto'
import { setPendingDraft } from '~/utils/DraftStore'
import { errorMessage } from '~/utils/Errors'

/** Photograph a cover; the library's vision AI reads it, then pick the matching edition (add) or search for it. */
export default function PhotoScreen() {
  const { mode = 'add', shelfId } = useLocalSearchParams<{ mode?: 'add' | 'search', shelfId?: string }>()
  const { library } = useCurrentLibrary()
  const canManageAi = useCan('ai.manage')
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ identification: IIdentification, candidates: IBookDraft[] } | null>(null)

  if (!library.visionProvider) {
    return (
      <Screen header={<Header title="Cover photo" close />}>
        <Card className="gap-3 py-5">
          <Feather name="cpu" size={24} color={Colors.primary} />
          <Text className="text-xl font-bold text-ink">{'📷 Photos need a smart helper'}</Text>
          <Text className="text-base text-muted">
            To know a book from its cover, this library needs an OpenAI or Gemini key.
            {canManageAi ? '' : ' Ask whoever looks after the library to add one.'} You can still scan the barcode or type the name.
          </Text>
          {canManageAi && <Button label="Set it up" icon="settings" onPress={() => router.replace('/ai-settings')} />}
        </Card>
      </Screen>
    )
  }

  async function capture(source: 'camera' | 'gallery') {
    setError(null)
    setResult(null)
    const photo = await captureCover(source)
    if (!photo) {
      return
    }
    setPhotoUri(photo.uri)
    setBusy(true)
    try {
      const identified = await identifyCover(library.id, photo.base64)
      if (mode === 'search') {
        const q = identified.identification.isbn ?? identified.identification.title
        if (!q) {
          setError('Hmm, I couldn\'t read that. Try again a bit closer, with good light 💡')
          return
        }
        router.back()
        router.navigate({ pathname: '/search', params: { q } })
        return
      }
      setResult(identified)
    }
    catch (e) {
      setError(errorMessage(e))
    }
    finally {
      setBusy(false)
    }
  }

  function choose(draft: IBookDraft) {
    setPendingDraft(draft, photoUri)
    router.replace({ pathname: '/add/review', params: { pending: '1', ...(shelfId ? { shelfId } : {}) } })
  }

  function chooseIdentification(id: IIdentification) {
    choose({
      isbn13: null,
      isbn10: null,
      title: id.title,
      subtitle: id.subtitle,
      authors: id.authors,
      publisher: id.publisher,
      publishedYear: null,
      pages: null,
      language: null,
      description: null,
      categories: [],
      tags: [],
      coverUrl: null,
    })
  }

  return (
    <Screen header={<Header title={mode === 'search' ? 'Find it with a photo' : 'Photo of the cover'} close />}>
      <Text className="text-center text-lg text-muted">Take a photo of the front of the book 📕</Text>
      <View className="flex-row gap-3">
        <View className="flex-1"><Button big icon="camera" label="Take photo" onPress={() => capture('camera')} disabled={busy} /></View>
        <View className="flex-1"><Button big variant="secondary" icon="image" label="Gallery" onPress={() => capture('gallery')} disabled={busy} /></View>
      </View>
      {busy && (
        <Card className="items-center gap-2 py-6">
          <Loading />
          <Text className="text-lg text-ink">Looking at the cover… 👀</Text>
        </Card>
      )}
      {error && <Text className="text-center text-sm text-negative">{error}</Text>}
      {result && (
        <View className="gap-3">
          <Text className="text-lg text-ink">
            {result.identification.title
              ? `Is it "${result.identification.title}"${result.identification.authors[0] ? ` by ${result.identification.authors[0]}` : ''}? Tap the right one:`
              : '🤔 I couldn\'t spot a book. Try another photo.'}
          </Text>
          {result.candidates.map(c => (
            <Pressable key={`${c.isbn13}-${c.title}-${c.publisher}`} onPress={() => choose(c)} className="flex-row gap-3 rounded-2xl border border-line bg-card p-3">
              <BookCover title={c.title} uri={c.coverUrl} width={48} />
              <View className="flex-1 gap-0.5">
                <Text className="text-base font-semibold text-ink" numberOfLines={2}>{c.title}</Text>
                <Text className="text-sm text-muted" numberOfLines={1}>{c.authors.join(', ')}</Text>
                <Text className="text-xs text-faint">{[c.publisher, c.publishedYear, c.isbn13].filter(Boolean).join(' · ')}</Text>
              </View>
            </Pressable>
          ))}
          {result.identification.title && (
            <Button variant="secondary" label="None of these, use the name I read" onPress={() => chooseIdentification(result.identification)} />
          )}
        </View>
      )}
    </Screen>
  )
}
