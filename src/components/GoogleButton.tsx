import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useAuth } from '~/auth/AuthProvider'
import { errorMessage } from '~/utils/Errors'

/** "Continue with Google" (Android Credential Manager). Shows its own error underneath. */
export function GoogleButton() {
  const { signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onPress() {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
    }
    catch (e) {
      const code = (e as { code?: string }).code
      setError(code === 'OAUTH_LINK_ERROR'
        ? 'This email already has an account. Sign in with your password or an emailed code, verify your email, then Google will work too.'
        : errorMessage(e))
    }
    finally {
      setBusy(false)
    }
  }

  return (
    <View className="gap-2">
      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        className="min-h-14 flex-row items-center justify-center gap-3 rounded-2xl border-2 border-line bg-card px-5 active:opacity-80"
      >
        {busy ? <ActivityIndicator /> : <Text className="text-xl font-bold text-[#4285F4]">G</Text>}
        <Text className="text-lg font-bold text-ink">Continue with Google</Text>
      </Pressable>
      {error && <Text className="text-center text-sm text-negative">{error}</Text>}
    </View>
  )
}
