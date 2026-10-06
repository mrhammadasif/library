import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { Colors } from '~/constants/Colors'
import { errorMessage } from '~/utils/Errors'

export function Loading() {
  return (
    <View className="items-center py-16">
      <ActivityIndicator color={Colors.primary} />
    </View>
  )
}

export function ErrorState({ error, onRetry, title = 'Oops, that didn\'t load' }: { error: unknown, onRetry: () => void, title?: string }) {
  return (
    <View className="items-center gap-3 rounded-2xl border border-line bg-card p-6">
      <Text className="text-base font-bold text-ink">{title}</Text>
      <Text className="text-center text-sm text-muted">{errorMessage(error)}</Text>
      <Pressable onPress={onRetry} className="min-h-12 justify-center rounded-full bg-walnut px-6">
        <Text className="text-base font-bold text-white">Try again</Text>
      </Pressable>
    </View>
  )
}

export function Empty({ text, action }: { text: string, action?: { label: string, onPress: () => void } }) {
  return (
    <View className="items-center gap-3 py-12">
      <Text className="text-center text-lg text-muted">{text}</Text>
      {action && (
        <Pressable onPress={action.onPress} className="min-h-12 justify-center rounded-full bg-primary px-6">
          <Text className="font-semibold text-white">{action.label}</Text>
        </Pressable>
      )}
    </View>
  )
}
