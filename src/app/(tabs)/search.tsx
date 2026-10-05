import type { ColorName } from '~/constants/BookColors'
import type { BookStatus } from '~/models/IBook'
import { Feather } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { BookRow } from '~/components/BookRow'
import { Chip } from '~/components/Chip'
import { Empty, ErrorState, Loading } from '~/components/EmptyState'
import { SafeArea } from '~/components/SafeArea'
import { BOOK_COLORS } from '~/constants/BookColors'
import { Colors } from '~/constants/Colors'
import { useBookSearch, useTags } from '~/hooks/Books'
import { shelfLabels, useRacks } from '~/hooks/Shelves'
import { useCurrentLibrary } from '~/library/LibraryProvider'

const STATUSES: { value: BookStatus, label: string }[] = [
  { value: 'on_shelf', label: 'On shelf' },
  { value: 'borrowed', label: 'Lent out' },
  { value: 'missing', label: 'Missing' },
  { value: 'archived', label: 'Archived' },
]

export default function SearchScreen() {
  const { library } = useCurrentLibrary()
  // "q" lets the cover-photo search hand over what it recognised.
  const params = useLocalSearchParams<{ q?: string }>()
  const [text, setText] = useState(params.q ?? '')
  const [query, setQuery] = useState(params.q ?? '')
  const [tags, setTags] = useState<string[]>([])
  const [color, setColor] = useState<ColorName | null>(null)
  const [status, setStatus] = useState<BookStatus | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const allTags = useTags(library.id)
  const racks = useRacks(library.id)
  const labels = shelfLabels(racks.data)
  const results = useBookSearch(library.id, { query, tags, color, status })
  const books = results.data?.pages.flat() ?? []
  const filterCount = tags.length + (color ? 1 : 0) + (status ? 1 : 0)

  // A new ?q= (e.g. from cover recognition) replaces the search text; adjusting state during render, not in an effect.
  const [seenQ, setSeenQ] = useState(params.q)
  if (params.q !== seenQ) {
    setSeenQ(params.q)
    if (params.q !== undefined) {
      setText(params.q)
      setQuery(params.q)
    }
  }

  // Debounce typing so every keystroke doesn't hit the database.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), 300)
    return () => clearTimeout(timer)
  }, [text])

  return (
    <SafeArea edges={['top']} className="flex-1 bg-canvas">
      <View className="gap-3 px-5 pb-3 pt-4">
        <Text className="text-3xl font-bold text-ink">Search</Text>
        <View className="flex-row items-center gap-2">
          <View className="flex-1 flex-row items-center gap-2 rounded-xl border border-line bg-card px-3">
            <Feather name="search" size={18} color={Colors.muted} />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Title, author, tag or ISBN"
              placeholderTextColor={Colors.faint}
              className="flex-1 py-3 text-base text-ink"
              returnKeyType="search"
              autoCorrect={false}
            />
            {text.length > 0 && (
              <Pressable hitSlop={8} onPress={() => setText('')}>
                <Feather name="x-circle" size={18} color={Colors.faint} />
              </Pressable>
            )}
          </View>
          <Pressable onPress={() => router.push({ pathname: '/add/photo', params: { mode: 'search' } })} className="h-12 w-12 items-center justify-center rounded-xl border border-line bg-card">
            <Feather name="camera" size={20} color={Colors.ink} />
          </Pressable>
          <Pressable onPress={() => setShowFilters(!showFilters)} className={`h-12 w-12 items-center justify-center rounded-xl border ${filterCount ? 'border-primary bg-primary-soft' : 'border-line bg-card'}`}>
            <Feather name="sliders" size={20} color={filterCount ? Colors.primary : Colors.ink} />
          </Pressable>
        </View>

        {showFilters && (
          <View className="gap-3">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              {STATUSES.map(s => (
                <Chip key={s.value} label={s.label} selected={status === s.value} onPress={() => setStatus(status === s.value ? null : s.value)} />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              {BOOK_COLORS.map(c => (
                <Chip key={c.name} label={c.label} swatch={c.swatch} selected={color === c.name} onPress={() => setColor(color === c.name ? null : c.name)} />
              ))}
            </ScrollView>
            {(allTags.data?.length ?? 0) > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                {allTags.data!.map(t => (
                  <Chip
                    key={t.tag}
                    label={`#${t.tag} ${t.books}`}
                    selected={tags.includes(t.tag)}
                    onPress={() => setTags(tags.includes(t.tag) ? tags.filter(x => x !== t.tag) : [...tags, t.tag])}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>

      <FlatList
        data={books}
        keyExtractor={b => b.id}
        contentContainerClassName="px-5 pb-36"
        keyboardShouldPersistTaps="handled"
        onEndReached={() => results.hasNextPage && !results.isFetchingNextPage && results.fetchNextPage()}
        renderItem={({ item, index }) => (
          <BookRow book={item} shelfLabel={item.shelfId ? labels.get(item.shelfId) : undefined} last={index === books.length - 1} />
        )}
        ListEmptyComponent={results.isPending
          ? <Loading />
          : results.error
            ? <ErrorState error={results.error} onRetry={results.refetch} />
            : <Empty text={query || filterCount ? 'No books match.' : 'Your library is empty.'} />}
      />
    </SafeArea>
  )
}
