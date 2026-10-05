import type { IBookFields } from '~/models/IBook'
import type { ColorName } from '~/constants/BookColors'
import { Text, View } from 'react-native'
import { BookCover } from '~/components/BookCover'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { ColorSwatches } from '~/components/ColorSwatches'
import { Field } from '~/components/Field'
import { TagInput } from '~/components/TagInput'

interface IBookFormProps {
  fields: IBookFields
  /** Reports which field changed so AI suggestions never overwrite user edits. */
  onChange: <K extends keyof IBookFields>(key: K, value: IBookFields[K]) => void
  /** Local photo URI that will replace the stored cover on save. */
  localCoverUri: string | null
  onTakeCover: () => void
  onPickCover: () => void
  tagSuggestions: string[]
  titleError?: string | null
}

function toNumber(text: string): number | null {
  const n = Number.parseInt(text.replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

/** The editable book fields shared by "add" review and "edit". */
export function BookForm({ fields, onChange, localCoverUri, onTakeCover, onPickCover, tagSuggestions, titleError }: IBookFormProps) {
  return (
    <View className="gap-4">
      <Card className="flex-row items-center gap-4 py-4">
        <BookCover
          title={fields.title || '?'}
          uri={localCoverUri}
          coverPath={fields.coverPath}
          coverUrl={fields.coverUrl}
          color={fields.dominantColor}
          width={84}
        />
        <View className="flex-1 gap-2">
          <Button small variant="secondary" icon="camera" label="Take cover photo" onPress={onTakeCover} />
          <Button small variant="ghost" icon="image" label="Choose from gallery" onPress={onPickCover} />
        </View>
      </Card>

      <Field label="Title" value={fields.title} onChangeText={v => onChange('title', v)} error={titleError} />
      <Field label="Subtitle" value={fields.subtitle ?? ''} onChangeText={v => onChange('subtitle', v)} />
      <TagInput label="Authors" values={fields.authors} onChange={v => onChange('authors', v)} placeholder="Add an author" />

      <View className="gap-1.5">
        <Text className="px-1 text-sm font-semibold text-muted">Colour (for finding it on the shelf)</Text>
        <ColorSwatches value={fields.colorName} onChange={(c: ColorName | null) => onChange('colorName', c)} />
      </View>

      <TagInput
        label="Tags"
        values={fields.tags}
        onChange={v => onChange('tags', v)}
        placeholder="e.g. classic, kids, signed"
        lowercase
        suggestions={tagSuggestions}
      />
      <TagInput label="Categories" values={fields.categories} onChange={v => onChange('categories', v)} placeholder="e.g. History" />

      <Field
        label="Description"
        value={fields.description ?? ''}
        onChangeText={v => onChange('description', v)}
        multiline
      />

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field label="ISBN-13" value={fields.isbn13 ?? ''} onChangeText={v => onChange('isbn13', v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={13} />
        </View>
        <View className="flex-1">
          <Field label="Year" value={fields.publishedYear?.toString() ?? ''} onChangeText={v => onChange('publishedYear', toNumber(v))} keyboardType="number-pad" maxLength={4} />
        </View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field label="Pages" value={fields.pages?.toString() ?? ''} onChangeText={v => onChange('pages', toNumber(v))} keyboardType="number-pad" />
        </View>
        <View className="flex-1">
          <Field label="Language" value={fields.language ?? ''} onChangeText={v => onChange('language', v.toLowerCase())} placeholder="en" maxLength={2} autoCapitalize="none" />
        </View>
      </View>
      <Field label="Publisher" value={fields.publisher ?? ''} onChangeText={v => onChange('publisher', v)} />
      <Field label="Condition" value={fields.condition ?? ''} onChangeText={v => onChange('condition', v)} placeholder="e.g. Like new, signed copy" />
      <Field label="Notes" value={fields.notes ?? ''} onChangeText={v => onChange('notes', v)} multiline />
    </View>
  )
}
