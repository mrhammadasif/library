import { useState } from 'react'
import { Text, View } from 'react-native'
import { authClient } from '~/api/Auth'
import { useAuth } from '~/auth/AuthProvider'
import { Button } from '~/components/Button'
import { CodeInput } from '~/components/CodeInput'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { errorMessage } from '~/utils/Errors'

/**
 * Deleting needs a fresh sign-in, so we email a code first and sign in with it (works for Google-only accounts too),
 * then delete. Blocked while you're the only owner of a library other people use.
 */
export default function DeleteAccountScreen() {
  const { user, sendCode, signInWithCode } = useAuth()
  const [step, setStep] = useState<'intro' | 'code'>('intro')
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

  async function confirmAndDelete() {
    await signInWithCode(user!.email, code)
    const { error: deleteError } = await authClient.deleteUser({})
    if (deleteError) {
      throw new Error(deleteError.message)
    }
    await authClient.signOut()
  }

  return (
    <Screen header={<Header title="Delete account" />}>
      <View className="items-center gap-3 pt-4">
        <Text className="text-6xl">🗑️</Text>
        <Text className="text-center text-lg text-ink">
          This removes your account and takes you out of every library. Libraries only you use are deleted too.
          Loans keep the borrower's name so other people's history still makes sense.
        </Text>
      </View>
      {step === 'intro'
        ? <Button big variant="danger" label="Email me a code to confirm" loading={busy} onPress={() => run(async () => { await sendCode(user!.email, 'sign-in'); setStep('code') })} />
        : (
            <>
              <Text className="text-center text-base text-muted">Type the code we sent to {user?.email}</Text>
              <CodeInput value={code} onChange={setCode} />
              <Button big variant="danger" icon="trash-2" label="Delete my account for good" loading={busy} disabled={code.length !== 6} onPress={() => run(confirmAndDelete)} />
            </>
          )}
      {error && <Text className="text-center text-base text-negative">{error}</Text>}
    </Screen>
  )
}
