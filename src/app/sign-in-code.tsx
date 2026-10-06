import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text } from 'react-native'
import { useAuth } from '~/auth/AuthProvider'
import { Button } from '~/components/Button'
import { CodeInput } from '~/components/CodeInput'
import { Field } from '~/components/Field'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { errorMessage } from '~/utils/Errors'

/** Passwordless sign-in: email → 6-digit code. Handy for kids who forget passwords. */
export default function SignInCodeScreen() {
  const params = useLocalSearchParams<{ email?: string }>()
  const { sendCode, signInWithCode } = useAuth()
  const [email, setEmail] = useState(params.email ?? '')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    }
    catch (e) {
      setError(errorMessage(e))
    }
    finally {
      setBusy(false)
    }
  }

  return (
    <Screen header={<Header title="Sign in with a code" />}>
      {!sent
        ? (
            <>
              <Field label="Your email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
              <Button big label="Email me a code" icon="mail" loading={busy} disabled={!email.includes('@')} onPress={() => run(async () => { await sendCode(email, 'sign-in'); setSent(true) })} />
            </>
          )
        : (
            <>
              <Text className="text-center text-lg text-muted">Type the 6-digit code we sent to {email}</Text>
              <CodeInput value={code} onChange={setCode} onComplete={otp => run(() => signInWithCode(email, otp))} />
              <Button big label="Sign in" loading={busy} disabled={code.length !== 6} onPress={() => run(() => signInWithCode(email, code))} />
              <Button variant="ghost" label="Send another code" onPress={() => run(() => sendCode(email, 'sign-in'))} />
            </>
          )}
      {error && <Text className="text-center text-base text-negative">{error}</Text>}
    </Screen>
  )
}
