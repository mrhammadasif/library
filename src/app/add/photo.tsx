import type { IBookDraft, IIdentification } from '~/models/IBookDraft'
import { Feather } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { FunctionError } from '~/api/Supabase'
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
  const { mode = 'add' } = useLocalSearchParams<{ mode?: 'add' | 'search' }>()
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
          <Text className="text-lg font-bold text-ink">{'Cover recognition isn\'t set up'}</Text>
          <Text className="text-base text-muted">
            Recognising books from a photo needs an OpenAI or Gemini API key for this library.
            {canManageAi ? '' : ' Ask the library owner to add one.'} You can still scan the barcode or type the book in.
          </Text>
          {canManageAi && <Button label="Set up AI" icon="settings" onPress={() => router.replace('/ai-settings')} />}
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
          setError('Couldn\'t read a title from that photo. Try again closer, with good light.')
          return
        }
        router.back()
        router.navigate({ pathname: '/search', params: { q } })
        return
      }
      setResult(identified)
    }
    catch (e) {
      setError(e instanceof FunctionError ? e.message : errorMessage(e))
    }
    finally {
      setBusy(false)
    }
  }

  function choose(draft: IBookDraft) {
    setPendingDraft(draft, photoUri)
    router.replace({ pathname: '/add/review', params: { pending: '1' } })
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
    <Screen header={<Header title={mode === 'search' ? 'Search by cover' : 'Add from cover photo'} close />}>
      <View className="flex-row gap-3">
        <View className="flex-1"><Button icon="camera" label="Take photo" onPress={() => capture('camera')} disabled={busy} /></View>
        <View className="flex-1"><Button variant="secondary" icon="image" label="Gallery" onPress={() => capture('gallery')} disabled={busy} /></View>
      </View>
      {busy && (
        <Card className="items-center gap-2 py-6">
          <Loading />
          <Text className="text-sm text-muted">Reading the cover…</Text>
        </Card>
      )}
      {error && <Text className="text-center text-sm text-negative">{error}</Text>}
      {result && (
        <View className="gap-3">
          <Text className="text-base text-ink">
            {result.identification.title
              ? `Looks like "${result.identification.title}"${result.identification.authors[0] ? ` by ${result.identification.authors[0]}` : ''}. Pick the matching edition:`
              : 'No book recognised. Try another photo.'}
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
            <Button variant="secondary" label="None of these: use what was read" onPress={() => chooseIdentification(result.identification)} />
          )}
        </View>
      )}
    </Screen>
  )
}
