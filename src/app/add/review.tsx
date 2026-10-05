import type { IBookFields } from '~/models/IBook'
import type { IBookDraft } from '~/models/IBookDraft'
import type { ILookupResult } from '~/hooks/Lookup'
import { randomUUID } from 'expo-crypto'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { BookCover } from '~/components/BookCover'
import { BookForm } from '~/components/BookForm'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { Loading } from '~/components/EmptyState'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { ShelfPicker } from '~/components/ShelfPicker'
import { StorageKeys } from '~/constants/StorageKeys'
import { useAddBook, useTags } from '~/hooks/Books'
import { enrichDraft, lookupIsbn, lookupText } from '~/hooks/Lookup'
import { useRacks } from '~/hooks/Shelves'
import { useCurrentLibrary } from '~/library/LibraryProvider'
import { applyEnrichment, draftToFields, emptyFields, fieldsToDraft } from '~/utils/BookForm'
import { hexToColorName } from '~/utils/ColorName'
import { captureCover } from '~/utils/CoverPhoto'
import { takePendingDraft } from '~/utils/DraftStore'
import { errorMessage } from '~/utils/Errors'
import { dominantColor, uploadCover } from '~/utils/ImagePrep'
import { readJson, writeJson } from '~/utils/Storage'

type AiState = 'off' | 'working' | 'done' | 'failed'

/**
 * The pre-filled "add book" form. Sources: ?isbn= (barcode → lookup-book), ?pending=1 (a candidate chosen from a
 * cover photo), or nothing (type it in, optionally "Find online"). AI enrichment fills tags/categories in the
 * background without overwriting anything the user has edited.
 */
export default function ReviewScreen() {
  const params = useLocalSearchParams<{ isbn?: string, pending?: string, from?: string }>()
  const { library } = useCurrentLibrary()
  const racks = useRacks(library.id)
  const tags = useTags(library.id)
  const addBook = useAddBook()
  const [fields, setFields] = useState<IBookFields>(() => ({ ...emptyFields(), isbn13: params.isbn ?? null }))
  // A ref, not state: async AI/colour callbacks must see edits made while they were running.
  const touched = useRef(new Set<keyof IBookFields>())
  const [localCover, setLocalCover] = useState<string | null>(null)
  const [shelfId, setShelfId] = useState<string | null>(null)
  const [lookup, setLookup] = useState<{ loading: boolean, result: ILookupResult | null, error: string | null }>({ loading: !!params.isbn, result: null, error: null })
  const [ai, setAi] = useState<AiState>('off')
  const [titleError, setTitleError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Remember the last shelf per library: batch-adding a shelf's worth of books is the common case.
  useEffect(() => {
    readJson<string>(StorageKeys.LastShelf(library.id)).then(id => id && setShelfId(prev => prev ?? id)).catch(() => {})
  }, [library.id])

  useEffect(() => {
    const pending = params.pending ? takePendingDraft() : null
    if (pending) {
      applyDraft(pending.draft)
      if (pending.photoUri) {
        setCover(pending.photoUri)
      }
      return
    }
    if (params.isbn) {
      lookupIsbn(library.id, params.isbn)
        .then((result) => {
          setLookup({ loading: false, result, error: null })
          if (result.draft) {
            applyDraft(result.draft)
          }
        })
        .catch(e => setLookup({ loading: false, result: null, error: errorMessage(e) }))
    }
    // Runs once per opened form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyDraft(draft: IBookDraft) {
    const next = draftToFields(draft)
    setFields(next)
    if (draft.coverUrl) {
      detectColor(draft.coverUrl)
    }
    enrich(next)
  }

  function enrich(base: IBookFields) {
    if (!library.enrichProvider || !base.title) {
      return
    }
    setAi('working')
    enrichDraft(library.id, fieldsToDraft(base))
      .then(({ enrichment }) => {
        setFields(current => applyEnrichment(current, enrichment, touched.current))
        setAi('done')
      })
      .catch(() => setAi('failed'))
  }

  function detectColor(uri: string) {
    dominantColor(uri).then((hex) => {
      if (hex) {
        setFields(current => ({
          ...current,
          dominantColor: hex,
          colorName: touched.current.has('colorName') ? current.colorName : hexToColorName(hex),
        }))
      }
    })
  }

  function setCover(uri: string) {
    setLocalCover(uri)
    detectColor(uri)
  }

  function onChange<K extends keyof IBookFields>(key: K, value: IBookFields[K]) {
    setFields(current => ({ ...current, [key]: value }))
    touched.current.add(key)
    if (key === 'title') {
      setTitleError(null)
    }
  }

  async function takeCover(source: 'camera' | 'gallery') {
    const photo = await captureCover(source)
    if (photo) {
      setCover(photo.uri)
    }
  }

  async function findOnline() {
    setLookup({ loading: true, result: null, error: null })
    try {
      const result = await lookupText(library.id, fields.title, fields.authors[0])
      setLookup({ loading: false, result, error: result.candidates.length ? null : 'Nothing found online.' })
    }
    catch (e) {
      setLookup({ loading: false, result: null, error: errorMessage(e) })
    }
  }

  async function save(next: 'scan' | 'book') {
    if (!fields.title.trim()) {
      setTitleError('A title is required')
      return
    }
    if (!shelfId) {
      setSaveError('Choose the shelf this book lives on.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const id = randomUUID()
      const coverPath = localCover ? await uploadCover(library.id, id, localCover) : fields.coverPath
      await addBook.mutateAsync({ libraryId: library.id, shelfId, id, fields: { ...fields, coverPath } })
      await writeJson(StorageKeys.LastShelf(library.id), shelfId)
      if (next === 'scan' && params.from === 'scan') {
        router.back()
      }
      else if (next === 'scan') {
        router.replace('/add/scan')
      }
      else {
        router.dismissAll()
        router.push({ pathname: '/book/[id]', params: { id } })
      }
    }
    catch (e) {
      setSaveError(errorMessage(e))
    }
    finally {
      setSaving(false)
    }
  }

  const existing = lookup.result?.existingCopies ?? []
  const candidates = lookup.result?.candidates ?? []
  return (
    <Screen header={<Header title="Review book" subtitle={params.isbn ? `ISBN ${params.isbn}` : undefined} />}>
      {lookup.loading && (
        <Card className="items-center gap-1 py-4">
          <Loading />
          <Text className="text-sm text-muted">Looking it up…</Text>
        </Card>
      )}
      {lookup.error && <Text className="text-sm text-warn">{lookup.error}</Text>}
      {params.isbn && !lookup.loading && !lookup.result?.draft && !lookup.error && (
        <Text className="text-sm text-warn">No details found online for this ISBN. Fill in the title and save.</Text>
      )}
      {existing.length > 0 && (
        <Card className="gap-1 border-warn bg-warn-soft py-3">
          <Text className="text-sm font-semibold text-ink">
            {existing.length === 1 ? 'You already have a copy of this book.' : `You already have ${existing.length} copies.`}
          </Text>
          <Text className="text-xs text-muted">Saving adds another copy.</Text>
        </Card>
      )}
      {ai === 'working' && <Text className="text-sm text-muted">✨ Getting tag suggestions from AI…</Text>}
      {ai === 'failed' && <Text className="text-sm text-faint">AI suggestions are unavailable right now.</Text>}

      {candidates.length > 0 && (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-muted">Pick a match</Text>
          {candidates.map(c => (
            <Pressable
              key={`${c.isbn13}-${c.title}-${c.publisher}`}
              onPress={() => {
                applyDraft(c)
                setLookup({ loading: false, result: null, error: null })
              }}
              className="flex-row gap-3 rounded-2xl border border-line bg-card p-3"
            >
              <BookCover title={c.title} uri={c.coverUrl} width={40} />
              <View className="flex-1">
                <Text className="text-base font-semibold text-ink" numberOfLines={2}>{c.title}</Text>
                <Text className="text-xs text-muted">{[c.authors[0], c.publisher, c.publishedYear].filter(Boolean).join(' · ')}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <Card className="gap-3 py-4">
        <Text className="text-base font-bold text-ink">Shelf</Text>
        {racks.data ? <ShelfPicker racks={racks.data} value={shelfId} onChange={setShelfId} /> : <Loading />}
      </Card>

      <BookForm
        fields={fields}
        onChange={onChange}
        localCoverUri={localCover}
        onTakeCover={() => takeCover('camera')}
        onPickCover={() => takeCover('gallery')}
        tagSuggestions={(tags.data ?? []).map(t => t.tag)}
        titleError={titleError}
      />
      {!params.isbn && !params.pending && (
        <Button variant="secondary" icon="globe" label="Find details online" disabled={!fields.title.trim()} onPress={findOnline} />
      )}

      {saveError && <Text className="text-center text-sm text-negative">{saveError}</Text>}
      <View className="gap-3">
        <Button label="Save & scan next" icon="maximize" loading={saving} onPress={() => save('scan')} />
        <Button variant="secondary" label="Save" loading={saving} onPress={() => save('book')} />
      </View>
    </Screen>
  )
}
