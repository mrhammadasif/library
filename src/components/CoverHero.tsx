import { Pressable, Text, View } from 'react-native'
import { BookCover } from '~/components/BookCover'
import { Button } from '~/components/Button'

interface ICoverHeroProps {
  title: string
  authors: string[]
  coverPath: string | null
  coverUrl: string | null
  localUri: string | null
  color: string | null
  onTakeCover: () => void
  onPickCover: () => void
}

/** Big cover + title: the "is this your book?" moment. Tap the cover to take a new photo. */
export function CoverHero({ title, authors, coverPath, coverUrl, localUri, color, onTakeCover, onPickCover }: ICoverHeroProps) {
  return (
    <View className="items-center gap-3">
      <Pressable onPress={onTakeCover} accessibilityRole="button" accessibilityLabel="Take a photo of the cover">
        <BookCover title={title || '?'} uri={localUri} coverPath={coverPath} coverUrl={coverUrl} color={color} width={150} />
      </Pressable>
      {title
        ? (
            <View className="items-center gap-1 px-4">
              <Text className="text-center text-2xl font-bold text-ink">{title}</Text>
              {authors.length > 0 && <Text className="text-center text-lg text-muted">{authors.join(', ')}</Text>}
            </View>
          )
        : null}
      <View className="flex-row gap-2">
        <Button small variant="secondary" icon="camera" label={localUri || coverPath || coverUrl ? 'New photo' : 'Add cover photo'} onPress={onTakeCover} />
        <Button small variant="ghost" icon="image" label="Gallery" onPress={onPickCover} />
      </View>
    </View>
  )
}
