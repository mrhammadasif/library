import type { IBookFields } from '~/models/IBook'
import { View } from 'react-native'
import { Field } from '~/components/Field'
import { TagInput } from '~/components/TagInput'
import { cleanIsbn, normalizeIsbn } from '~shared/isbn'

type OnChange = <K extends keyof IBookFields>(key: K, value: IBookFields[K]) => void

function toNumber(text: string): number | null {
  const n = Number.parseInt(text.replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

/** ISBN-13 or ISBN-10 (keeps the X); flags a full-length number whose check digit is wrong. */
function IsbnField({ fields, onChange, label, hint }: { fields: IBookFields, onChange: OnChange, label: string, hint?: string }) {
  const value = fields.isbn13 ?? ''
  const wrong = (value.length === 10 || value.length === 13) && !normalizeIsbn(value)
  return (
    <Field
      testID="book-isbn"
      label={label}
      value={value}
      onChangeText={v => onChange('isbn13', cleanIsbn(v) || null)}
      keyboardType="default"
      autoCapitalize="characters"
      autoCorrect={false}
      maxLength={17}
      error={wrong ? 'That ISBN doesn\'t look right. Check the digits.' : undefined}
      hint={wrong ? undefined : hint}
    />
  )
}

/** Title, subtitle and authors: what most people ever need to fix. `isbn` adds the ISBN right here (add-book form). */
export function BookBasicsForm({ fields, onChange, titleError, isbn = false }: { fields: IBookFields, onChange: OnChange, titleError?: string | null, isbn?: boolean }) {
  return (
    <View className="gap-4">
      <Field testID="book-title" label="Title" value={fields.title} onChangeText={v => onChange('title', v)} error={titleError} placeholder="What's the book called?" />
      <TagInput label="Author" values={fields.authors} onChange={v => onChange('authors', v)} placeholder="Who wrote it?" />
      <Field label="Subtitle (optional)" value={fields.subtitle ?? ''} onChangeText={v => onChange('subtitle', v)} />
      {isbn && <IsbnField fields={fields} onChange={onChange} label="ISBN (optional)" hint="The number by the barcode on the back. Type it to find the book online." />}
    </View>
  )
}

/** Everything else, tucked behind "More details". */
export function BookDetailsForm({ fields, onChange, tagSuggestions, isbn = true }: { fields: IBookFields, onChange: OnChange, tagSuggestions: string[], isbn?: boolean }) {
  return (
    <View className="gap-4">
      <TagInput
        label="Tags (to find it later)"
        values={fields.tags}
        onChange={v => onChange('tags', v)}
        placeholder="e.g. dinosaurs, bedtime, school"
        lowercase
        suggestions={tagSuggestions}
      />
      <TagInput label="Categories" values={fields.categories} onChange={v => onChange('categories', v)} placeholder="e.g. History" />
      <Field label="What's it about?" value={fields.description ?? ''} onChangeText={v => onChange('description', v)} multiline testID="book-description-input" />
      <View className="flex-row gap-3">
        {isbn && (
          <View className="flex-1">
            <IsbnField fields={fields} onChange={onChange} label="ISBN" />
          </View>
        )}
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
      <Field label="Condition" value={fields.condition ?? ''} onChangeText={v => onChange('condition', v)} placeholder="e.g. Like new, signed" />
      <Field label="Notes" value={fields.notes ?? ''} onChangeText={v => onChange('notes', v)} multiline />
    </View>
  )
}
