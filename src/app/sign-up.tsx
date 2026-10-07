import { useState } from 'react'
import { Text } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { useAuth } from '~/auth/AuthProvider'
import { Button } from '~/components/Button'
import { Field } from '~/components/Field'
import { GoogleButton } from '~/components/GoogleButton'
import { Header } from '~/components/Header'
import { SafeArea } from '~/components/SafeArea'
import { errorMessage } from '~/utils/Errors'

/** After sign-up the user is signed in but unverified; the root layout then shows the verify-email screen. */
export default function SignUpScreen() {
  const { signUp } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit() {
    setError(null)
    if (password.length < 8) {
      setError('Use at least 8 characters for the password.')
      return
    }
    setBusy(true)
    try {
      await signUp(name, email, password)
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
      <Header title="Create account" />
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{ gap: 16, paddingHorizontal: 28, paddingBottom: 40, paddingTop: 16 }}
        keyboardShouldPersistTaps="handled"
      >
          <GoogleButton />
          <Text className="py-2 text-center text-base text-muted">or use your email</Text>
          <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" hint="Shown to people you share a library with" />
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" hint="We'll email you a code to check it's yours" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
          {error && <Text className="text-center text-base text-negative">{error}</Text>}
          <Button big label="Create account" onPress={onSubmit} loading={busy} disabled={!name.trim() || !email || !password} />
      </KeyboardAwareScrollView>
    </SafeArea>
  )
}
