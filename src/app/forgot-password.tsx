import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text } from 'react-native'
import { useAuth } from '~/auth/AuthProvider'
import { Button } from '~/components/Button'
import { CodeInput } from '~/components/CodeInput'
import { Field } from '~/components/Field'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { useToast } from '~/components/Toast'
import { errorMessage } from '~/utils/Errors'

/** Email → code → new password. No links to tap, so it works on the same phone without switching apps. */
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>()
  const { sendCode, resetPassword } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState(params.email ?? '')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
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
    <Screen header={<Header title="New password" />}>
      {!sent
        ? (
            <>
              <Field label="Your email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
              <Button big label="Email me a code" icon="mail" loading={busy} disabled={!email.includes('@')} onPress={() => run(async () => { await sendCode(email, 'forget-password'); setSent(true) })} />
            </>
          )
        : (
            <>
              <Text className="text-center text-lg text-muted">Type the code we sent to {email}, then choose a new password.</Text>
              <CodeInput value={code} onChange={setCode} />
              <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" hint="At least 8 characters" />
              <Button
                big
                label="Save new password"
                loading={busy}
                disabled={code.length !== 6 || password.length < 8}
                onPress={() => run(async () => {
                  await resetPassword(email, code, password)
                  toast('Password changed. Sign in with it now.', '🔑')
                  router.replace('/sign-in')
                })}
              />
            </>
          )}
      {error && <Text className="text-center text-base text-negative">{error}</Text>}
    </Screen>
  )
}
