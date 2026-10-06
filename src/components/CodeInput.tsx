import { TextInput } from 'react-native'
import { Colors } from '~/constants/Colors'

/** One big field for a 6-digit emailed code; autofills from the SMS/email suggestion bar where supported. */
export function CodeInput({ value, onChange, onComplete }: { value: string, onChange: (code: string) => void, onComplete?: (code: string) => void }) {
  return (
    <TextInput
      value={value}
      onChangeText={(text) => {
        const code = text.replace(/\D/g, '').slice(0, 6)
        onChange(code)
        if (code.length === 6) {
          onComplete?.(code)
        }
      }}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="••••••"
      placeholderTextColor={Colors.faint}
      accessibilityLabel="6-digit code"
      className="min-h-20 rounded-2xl border-2 border-primary bg-card text-center text-4xl font-bold tracking-[12px] text-ink"
    />
  )
}
