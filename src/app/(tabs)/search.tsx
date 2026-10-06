import type { ColorName } from '~/constants/BookColors'
import type { BookStatus } from '~/models/IBook'
import { Feather } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { BookTile } from '~/components/BookTile'
import { useTileWidth } from '~/components/BookGrid'
import { Chip } from '~/components/Chip'
import { Empty, ErrorState, Loading } from '~/components/EmptyState'
import { SafeArea } from '~/components/SafeArea'
import { BOOK_COLORS } from '~/constants/BookColors'
import { Colors } from '~/constants/Colors'
import { useBookSearch, useTags } from '~/hooks/Books'
import { useCurrentLibrary } from '~/library/LibraryProvider'

const STATUSES: { value: BookStatus, label: string }[] = [
  { value: 'borrowed', label: '📖 Borrowed' },
  { value: 'missing', label: '❓ Missing' },
  { value: 'archived', label: '🎁 Given away' },
]

export default function SearchScreen() {
  const { library } = useCurrentLibrary()
  // "q" lets the cover-photo search and tag chips hand over a query.
  const params = useLocalSearchParams<{ q?: string }>()
  const [text, setText] = useState(params.q ?? '')
  const [query, setQuery] = useState(params.q ?? '')
  const [tags, setTags] = useState<string[]>([])
  const [color, setColor] = useState<ColorName | null>(null)
  const [status, setStatus] = useState<BookStatus | null>(null)
  const allTags = useTags(library.id)
  const results = useBookSearch(library.id, { query, tags, color, status })
  const books = results.data?.pages.flat() ?? []
  const tileWidth = useTileWidth(3)
  const filtered = !!(query || tags.length || color || status)

  // A new ?q= replaces the search text; adjusting state during render, not in an effect.
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

  function clearAll() {
    setText('')
    setQuery('')
    setTags([])
    setColor(null)
    setStatus(null)
  }

  const header = (
    <View className="gap-4 pb-4">
      <View className="flex-row items-center justify-between pt-3">
        <Text className="text-3xl font-bold text-ink">Find a book</Text>
        {filtered && <Pressable onPress={clearAll} hitSlop={10}><Text className="text-base font-semibold text-primary">Clear</Text></Pressable>}
      </View>
      <View className="min-h-14 flex-row items-center gap-3 rounded-2xl border-2 border-line bg-card px-4">
        <Feather name="search" size={22} color={Colors.muted} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Book name, author or tag"
          placeholderTextColor={Colors.faint}
          className="flex-1 py-3 text-lg text-ink"
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search"
        />
        {text.length > 0 && (
          <Pressable hitSlop={10} onPress={() => setText('')} accessibilityLabel="Clear search">
            <Feather name="x-circle" size={22} color={Colors.faint} />
          </Pressable>
        )}
      </View>

      {library.visionProvider && (
        <Pressable
          onPress={() => router.push({ pathname: '/add/photo', params: { mode: 'search' } })}
          className="min-h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-primary-soft"
        >
          <Text className="text-xl">📷</Text>
          <Text className="text-lg font-bold text-primary">Find it with a photo</Text>
        </Pressable>
      )}

      <View className="gap-2">
        <Text className="text-base font-bold text-muted">What colour is it?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pr-5">
          {BOOK_COLORS.map((c) => {
            const on = color === c.name
            return (
              <Pressable
                key={c.name}
                onPress={() => setColor(on ? null : c.name)}
                accessibilityRole="button"
                accessibilityLabel={c.label}
                accessibilityState={{ selected: on }}
                className="items-center gap-1"
              >
                <View
                  className={`h-12 w-12 items-center justify-center rounded-full border-4 ${on ? 'border-primary' : 'border-line'}`}
                  style={{ backgroundColor: c.swatch }}
                >
                  {on && <Feather name="check" size={20} color={c.name === 'white' || c.name === 'yellow' ? '#000' : '#fff'} />}
                </View>
                <Text className={`text-xs ${on ? 'font-bold text-primary' : 'text-muted'}`}>{c.label}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      {(allTags.data?.length ?? 0) > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-5">
          {allTags.data!.slice(0, 20).map(t => (
            <Chip
              key={t.tag}
              label={`#${t.tag}`}
              selected={tags.includes(t.tag)}
              onPress={() => setTags(tags.includes(t.tag) ? tags.filter(x => x !== t.tag) : [...tags, t.tag])}
            />
          ))}
        </ScrollView>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-5">
        {STATUSES.map(s => (
          <Chip key={s.value} label={s.label} selected={status === s.value} onPress={() => setStatus(status === s.value ? null : s.value)} />
        ))}
      </ScrollView>

      {!results.isPending && books.length > 0 && (
        <Text className="text-base text-muted">{filtered ? `${books.length}${results.hasNextPage ? '+' : ''} found` : 'Newest first'}</Text>
      )}
    </View>
  )

  return (
    <SafeArea edges={['top']} className="flex-1 bg-canvas">
      <FlatList
        data={books}
        keyExtractor={b => b.id}
        numColumns={3}
        columnWrapperStyle={{ gap: 14 }}
        contentContainerStyle={{ gap: 16 }}
        contentContainerClassName="px-5 pb-36"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={header}
        onEndReached={() => results.hasNextPage && !results.isFetchingNextPage && results.fetchNextPage()}
        renderItem={({ item }) => <BookTile book={item} width={tileWidth} />}
        ListEmptyComponent={results.isPending
          ? <Loading />
          : results.error
            ? <ErrorState error={results.error} onRetry={results.refetch} />
            : <Empty text={filtered ? '🙈 No books match. Try fewer words or another colour.' : '📭 No books yet.'} />}
      />
    </SafeArea>
  )
}
