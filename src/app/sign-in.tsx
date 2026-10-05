import { Feather } from '@expo/vector-icons'
import { Link } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Text, View } from 'react-native'
import { useAuth } from '~/auth/AuthProvider'
import { Button } from '~/components/Button'
import { Field } from '~/components/Field'
import { SafeArea } from '~/components/SafeArea'
import { errorMessage } from '~/utils/Errors'

export default function SignInScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit() {
    setError(null)
    setBusy(true)
    try {
      await signIn(email, password)
    }
    catch (e) {
      setError(errorMessage(e))
    }
    finally {
      setBusy(false)
    }
  }

  return (
    <SafeArea className="flex-1 bg-canvas">
      <KeyboardAvoidingView behavior="padding" className="flex-1 justify-center gap-8 px-7">
        <View className="gap-3">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Feather name="book-open" size={30} color="#fff" />
          </View>
          <Text className="text-4xl font-bold tracking-tight text-ink">Home Library</Text>
          <Text className="text-base text-muted">Every book on every shelf, one scan away.</Text>
        </View>
        <View className="gap-4">
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" onSubmitEditing={onSubmit} />
          {error && <Text className="text-center text-sm text-negative">{error}</Text>}
          <Button label="Sign in" onPress={onSubmit} loading={busy} disabled={!email || !password} />
          <Link href="/sign-up" className="py-2 text-center text-base font-semibold text-primary">New here? Create an account</Link>
        </View>
      </KeyboardAvoidingView>
    </SafeArea>
  )
}
