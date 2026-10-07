import { Feather } from '@expo/vector-icons'
import { Link } from 'expo-router'
import type { TextInput } from 'react-native'
import { useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
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
  const passwordRef = useRef<TextInput>(null)
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
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: 28, paddingHorizontal: 28, paddingVertical: 40 }}
        keyboardShouldPersistTaps="handled"
      >
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
            <Field
              testID="sign-in-email"
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <Field
              ref={passwordRef}
              testID="sign-in-password"
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />
            {error && <Text className="text-center text-base text-negative">{error}</Text>}
            <Button big label="Sign in" onPress={onSubmit} loading={busy} disabled={!email || !password} />
            <View className="flex-row justify-between">
              <Link href={{ pathname: '/sign-in-code', params: { email } }} className="py-2 text-base font-semibold text-primary">Email me a code</Link>
              <Link href={{ pathname: '/forgot-password', params: { email } }} className="py-2 text-base font-semibold text-primary">Forgot password?</Link>
            </View>
          </View>
          <Link href="/sign-up" className="py-3 text-center text-lg font-semibold text-primary">New here? Create an account</Link>
      </KeyboardAwareScrollView>
    </SafeArea>
  )
}
