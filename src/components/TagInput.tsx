import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { Chip } from '~/components/Chip'
import { Colors } from '~/constants/Colors'
import { splitList } from '~/utils/BookForm'

interface ITagInputProps {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  /** Tags are stored lowercase; authors/categories keep their case. */
  lowercase?: boolean
  suggestions?: string[]
}

/** Chips plus a text box; commas or "done" add entries. */
export function TagInput({ label, values, onChange, placeholder, lowercase = false, suggestions = [] }: ITagInputProps) {
  const [text, setText] = useState('')

  function add(raw: string) {
    const parts = splitList(raw).map(p => (lowercase ? p.toLowerCase() : p))
    const next = [...values]
    for (const part of parts) {
      if (!next.some(v => v.toLowerCase() === part.toLowerCase())) {
        next.push(part)
      }
    }
    onChange(next)
    setText('')
  }

  const unused = suggestions.filter(s => !values.some(v => v.toLowerCase() === s.toLowerCase())).slice(0, 8)
  return (
    <View className="gap-1.5">
      <Text className="px-1 text-sm font-semibold text-muted">{label}</Text>
      <View className="gap-2 rounded-xl border border-line bg-card px-3 py-2.5">
        {values.length > 0 && (
          <View className="flex-row flex-wrap gap-2">
            {values.map(v => <Chip key={v} label={v} onRemove={() => onChange(values.filter(x => x !== v))} />)}
          </View>
        )}
        <TextInput
          value={text}
          onChangeText={(t) => {
            if (/[,;\n]/.test(t)) {
              add(t)
            }
            else {
              setText(t)
            }
          }}
          onSubmitEditing={() => add(text)}
          onBlur={() => text.trim() && add(text)}
          submitBehavior="submit"
          placeholder={placeholder}
          placeholderTextColor={Colors.faint}
          className="py-1 text-base text-ink"
        />
      </View>
      {unused.length > 0 && (
        <View className="flex-row flex-wrap gap-2 pt-1">
          {unused.map(s => <Chip key={s} label={`+ ${s}`} onPress={() => add(s)} />)}
        </View>
      )}
    </View>
  )
}
