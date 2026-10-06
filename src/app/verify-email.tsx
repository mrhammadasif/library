import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useAuth } from '~/auth/AuthProvider'
import { Button } from '~/components/Button'
import { CodeInput } from '~/components/CodeInput'
import { Screen } from '~/components/Screen'
import { useToast } from '~/components/Toast'
import { errorMessage } from '~/utils/Errors'

const COOLDOWN = 60

/** Signed in but not verified yet (read-only): type the emailed code to unlock the app. */
export default function VerifyEmailScreen() {
  const { user, verifyEmail, sendCode, signOut } = useAuth()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wait, setWait] = useState(COOLDOWN)

  useEffect(() => {
    if (wait <= 0) {
      return
    }
    const timer = setTimeout(() => setWait(wait - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  async function verify(otp = code) {
    setBusy(true)
    setError(null)
    try {
      await verifyEmail(user!.email, otp)
      toast('Email confirmed!', '🎉')
    }
    catch (e) {
      setError(errorMessage(e))
      setCode('')
    }
    finally {
      setBusy(false)
    }
  }

  async function resend() {
    setError(null)
    try {
      await sendCode(user!.email, 'email-verification')
      setWait(COOLDOWN)
      toast('New code sent', '📬')
    }
    catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Screen>
      <View className="items-center gap-3 pt-10">
        <Text className="text-6xl">📬</Text>
        <Text className="text-center text-3xl font-bold text-ink">Check your email</Text>
        <Text className="text-center text-lg text-muted">
          We sent a 6-digit code to{'\n'}
          <Text className="font-bold text-ink">{user?.email}</Text>
        </Text>
      </View>
      <CodeInput value={code} onChange={setCode} onComplete={verify} />
      {error && <Text className="text-center text-base text-negative">{error}</Text>}
      <Button big label="Confirm" icon="check" loading={busy} disabled={code.length !== 6} onPress={() => verify()} />
      <Button variant="ghost" label={wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'} disabled={wait > 0} onPress={resend} />
      <Button variant="ghost" label="Use a different email" onPress={signOut} />
    </Screen>
  )
}
