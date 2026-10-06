import type { TextInputProps } from 'react-native'
import { Text, TextInput, View } from 'react-native'
import { Colors } from '~/constants/Colors'

interface IFieldProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  label: string
  value: string
  onChangeText: (text: string) => void
  hint?: string
  error?: string | null
}

/** Labelled text input. */
export function Field({ label, value, onChangeText, hint, error, multiline, ...rest }: IFieldProps) {
  return (
    <View className="gap-1.5">
      <Text className="px-1 text-base font-semibold text-muted">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor={Colors.faint}
        className={`min-h-14 rounded-2xl border-2 bg-card px-4 py-3 text-lg text-ink ${error ? 'border-negative' : 'border-line'} ${multiline ? 'min-h-28' : ''}`}
        style={multiline ? { textAlignVertical: 'top' } : undefined}
        {...rest}
      />
      {(error || hint) && <Text className={`px-1 text-sm ${error ? 'font-semibold text-negative' : 'text-muted'}`}>{error ?? hint}</Text>}
    </View>
  )
}
