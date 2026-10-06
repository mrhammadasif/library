import { Feather } from '@expo/vector-icons'
import { Link } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native'
import { useAuth } from '~/auth/AuthProvider'
import { Button } from '~/components/Button'
import { Field } from '~/components/Field'
import { GoogleButton } from '~/components/GoogleButton'
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
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView contentContainerClassName="grow justify-center gap-7 px-7 py-10" keyboardShouldPersistTaps="handled">
          <View className="gap-3">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary">
              <Feather name="book-open" size={30} color="#fff" />
            </View>
            <Text className="text-4xl font-bold tracking-tight text-ink">Home Library</Text>
            <Text className="text-lg text-muted">Every book on every shelf, one scan away 📚</Text>
          </View>
          <GoogleButton />
          <View className="flex-row items-center gap-3">
            <View className="h-px flex-1 bg-line" />
            <Text className="text-base text-muted">or</Text>
            <View className="h-px flex-1 bg-line" />
          </View>
          <View className="gap-4">
            <Field testID="sign-in-email" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            <Field testID="sign-in-password" label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" onSubmitEditing={onSubmit} />
            {error && <Text className="text-center text-base text-negative">{error}</Text>}
            <Button big label="Sign in" onPress={onSubmit} loading={busy} disabled={!email || !password} />
            <View className="flex-row justify-between">
              <Link href={{ pathname: '/sign-in-code', params: { email } }} className="py-2 text-base font-semibold text-primary">Email me a code</Link>
              <Link href={{ pathname: '/forgot-password', params: { email } }} className="py-2 text-base font-semibold text-primary">Forgot password?</Link>
            </View>
          </View>
          <Link href="/sign-up" className="py-3 text-center text-lg font-semibold text-primary">New here? Create an account</Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeArea>
  )
}
