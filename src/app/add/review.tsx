import type { IBookFields } from '~/models/IBook'
import type { IBookDraft } from '~/models/IBookDraft'
import type { ILookupResult } from '~/hooks/Lookup'
import { randomUUID } from 'expo-crypto'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { BookCover } from '~/components/BookCover'
import { BookBasicsForm, BookDetailsForm } from '~/components/BookForm'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { Collapsible } from '~/components/Collapsible'
import { ColorSwatches } from '~/components/ColorSwatches'
import { CoverHero } from '~/components/CoverHero'
import { Loading } from '~/components/EmptyState'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { ShelfChoice, ShelfPicker } from '~/components/ShelfPicker'
import { useToast } from '~/components/Toast'
import { StorageKeys } from '~/constants/StorageKeys'
import { useAddBook, useTags } from '~/hooks/Books'
import { enrichDraft, lookupIsbn, lookupText } from '~/hooks/Lookup'
import { shelfLabels, useRacks } from '~/hooks/Shelves'
import { useCurrentLibrary } from '~/library/LibraryProvider'
import { applyEnrichment, draftToFields, emptyFields, fieldsToDraft, fillBlanks } from '~/utils/BookForm'
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
  const params = useLocalSearchParams<{ isbn?: string, pending?: string, from?: string, shelfId?: string }>()
  const { library } = useCurrentLibrary()
  const racks = useRacks(library.id)
  const tags = useTags(library.id)
  const addBook = useAddBook()
  const toast = useToast()
  const [lastShelf, setLastShelf] = useState<string | null>(null)
  const [pickingShelf, setPickingShelf] = useState(false)
  const [fields, setFields] = useState<IBookFields>(() => ({ ...emptyFields(), isbn13: params.isbn ?? null }))
  // A ref, not state: async AI/colour callbacks must see edits made while they were running.
  const touched = useRef(new Set<keyof IBookFields>())
  const [localCover, setLocalCover] = useState<string | null>(null)
  // Opened from a shelf's "Add a book here": that shelf is chosen. Otherwise the last-used shelf (effect below).
  const [shelfId, setShelfId] = useState<string | null>(params.shelfId ?? null)
  const [lookup, setLookup] = useState<{ loading: boolean, result: ILookupResult | null, error: string | null }>({ loading: !!params.isbn, result: null, error: null })
  const [ai, setAi] = useState<AiState>('off')
  const [titleError, setTitleError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Remember the last shelf per library: batch-adding a shelf's worth of books is the common case.
  useEffect(() => {
    readJson<string>(StorageKeys.LastShelf(library.id)).then((id) => {
      if (id) {
        setLastShelf(id)
        setShelfId(prev => prev ?? id)
      }
    }).catch(() => {})
  }, [library.id])

  useEffect(() => {
    const pending = params.pending ? takePendingDraft() : null
    if (pending) {
      chooseCandidate(pending.draft)
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

  /**
   * A result from "Find it online" or a cover photo: search results are thin, so when it has an ISBN fetch the full
   * per-ISBN record (both book sources) and fill the blanks before asking AI for the rest.
   */
  async function chooseCandidate(draft: IBookDraft) {
    setFields(draftToFields(draft))
    let full = draft
    if (draft.isbn13) {
      setLookup({ loading: true, result: null, error: null })
      try {
        const result = await lookupIsbn(library.id, draft.isbn13)
        full = result.draft ? fillBlanks(draft, result.draft) : draft
        setLookup({ loading: false, result: { ...result, draft: full, candidates: [] }, error: null })
      }
      catch {
        setLookup({ loading: false, result: null, error: null })
      }
    }
    applyDraft(full)
  }

  function enrich(base: IBookFields) {
    // The library's own AI provider, or the home server's AI when the admin allowed it for this library.
    if (!(library.enrichProvider || library.homeAiAllowed) || !base.title) {
      return
    }
    setAi('working')
    enrichDraft(library.id, fieldsToDraft(base))
      .then(({ enrichment }) => {
        setFields(current => applyEnrichment(current, enrichment, touched.current))
        setAi('done')
        // The AI found the ISBN on the web: the book databases may know the rest (and whether it's already here).
        if (enrichment.isbn13 && !base.isbn13) {
          fillFromIsbn(enrichment.isbn13)
        }
      })
      .catch(() => setAi('failed'))
  }

  function fillFromIsbn(isbn13: string) {
    lookupIsbn(library.id, isbn13)
      .then((result) => {
        setLookup({ loading: false, result: { ...result, candidates: [] }, error: null })
        if (result.draft) {
          const found = draftToFields(result.draft)
          setFields((current) => {
            const next = { ...current }
            for (const key of ['publisher', 'publishedYear', 'pages', 'subtitle', 'description', 'language'] as const) {
              if (!touched.current.has(key) && !current[key] && found[key]) {
                Object.assign(next, { [key]: found[key] })
              }
            }
            return next
          })
        }
      })
      .catch(() => {})
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

  async function save() {
    if (!fields.title.trim()) {
      setTitleError('Type the book\'s name first')
      return
    }
    if (!shelfId) {
      setSaveError('Pick a shelf first 👆')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const id = randomUUID()
      const coverPath = localCover ? await uploadCover(library.id, id, localCover) : fields.coverPath
      await addBook.mutateAsync({ libraryId: library.id, shelfId, id, fields: { ...fields, coverPath } })
      await writeJson(StorageKeys.LastShelf(library.id), shelfId)
      toast(`Added to ${shelfLabels(racks.data).get(shelfId) ?? 'the shelf'}`, '📚')
      // From the scanner: straight back to it, ready for the next book.
      if (params.from === 'scan') {
        router.back()
      }
      else {
        router.replace({ pathname: '/book/[id]', params: { id } })
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
  const found = !!fields.title && !lookup.loading
  const shelfLabel = shelfId ? shelfLabels(racks.data).get(shelfId) : undefined
  return (
    <Screen header={<Header title={found ? 'Is this your book?' : 'Add a book'} />}>
      {lookup.loading
        ? (
            <Card className="items-center gap-2 py-10">
              <Loading />
              <Text className="text-lg text-ink">Looking it up… 🔎</Text>
            </Card>
          )
        : (
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
          )}

      {lookup.error && <Text className="text-center text-base text-warn">{lookup.error}</Text>}
      {existing.length > 0 && (
        <Card className="flex-row items-center gap-3 border-warn bg-warn-soft py-3">
          <Text className="text-2xl">👯</Text>
          <Text className="flex-1 text-base text-ink">
            {existing.length === 1 ? 'You already have this book. Saving adds a second copy.' : `You already have ${existing.length} copies. Saving adds another.`}
          </Text>
        </Card>
      )}
      {ai === 'working' && <Text className="text-center text-base text-muted">✨ Adding tags with AI…</Text>}

      {candidates.length > 0 && (
        <View className="gap-2">
          <Text className="text-lg font-bold text-ink">Which one is it?</Text>
          {candidates.map(c => (
            <Pressable
              key={`${c.isbn13}-${c.title}-${c.publisher}`}
              onPress={() => chooseCandidate(c)}
              className="min-h-16 flex-row items-center gap-3 rounded-2xl border-2 border-line bg-card p-3"
            >
              <BookCover title={c.title} uri={c.coverUrl} width={48} />
              <View className="flex-1">
                <Text className="text-lg font-semibold text-ink" numberOfLines={2}>{c.title}</Text>
                <Text className="text-sm text-muted">{[c.authors[0], c.publisher, c.publishedYear].filter(Boolean).join(' · ')}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {!lookup.loading && (
        <>
          {!fields.title && params.isbn && (
            <Text className="text-center text-base text-muted">We couldn't find this book online. Type its name below 👇</Text>
          )}
          <Collapsible title={fields.title ? '✏️ Fix the title or author' : '✏️ Title and author'} initiallyOpen={!fields.title}>
            <BookBasicsForm fields={fields} onChange={onChange} titleError={titleError} />
            {!params.isbn && !params.pending && (
              <Button variant="secondary" icon="globe" label="Find it online" disabled={!fields.title.trim()} onPress={findOnline} />
            )}
          </Collapsible>

          <View className="gap-3">
            <Text className="text-xl font-bold text-ink">Which shelf does it go on?</Text>
            {shelfLabel && !pickingShelf
              ? <ShelfChoice label={shelfLabel} onChange={() => setPickingShelf(true)} />
              : racks.data
                ? (
                    <ShelfPicker
                      racks={racks.data}
                      value={shelfId}
                      recent={lastShelf}
                      onChange={(id) => {
                        setShelfId(id)
                        setPickingShelf(false)
                        setSaveError(null)
                      }}
                    />
                  )
                : <Loading />}
          </View>

          <View className="gap-3">
            <Text className="text-xl font-bold text-ink">What colour is it?</Text>
            <Text className="-mt-2 text-sm text-muted">Helps you spot it on the shelf later.</Text>
            <ColorSwatches value={fields.colorName} onChange={c => onChange('colorName', c)} />
          </View>

          <Collapsible title="More details">
            <BookDetailsForm fields={fields} onChange={onChange} tagSuggestions={(tags.data ?? []).map(t => t.tag)} />
          </Collapsible>

          {saveError && <Text className="text-center text-base text-negative">{saveError}</Text>}
          <Button big icon="check" label="Put it on the shelf" loading={saving} onPress={save} />
        </>
      )}
    </Screen>
  )
}
