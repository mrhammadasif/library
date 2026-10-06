import { router } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Text, View } from 'react-native'
import { useAuth } from '~/auth/AuthProvider'
import { Button } from '~/components/Button'
import { Field } from '~/components/Field'
import { Header } from '~/components/Header'
import { SafeArea } from '~/components/SafeArea'
import { errorMessage } from '~/utils/Errors'

export default function SignUpScreen() {
  const { signUp } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)

  async function onSubmit() {
    setError(null)
    if (password.length < 8) {
      setError('Use at least 8 characters for the password.')
      return
    }
    setBusy(true)
    try {
      if (await signUp(name, email, password) === 'confirm') {
        setConfirm(true)
      }
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
      <KeyboardAvoidingView behavior="padding" className="flex-1 gap-4 px-7 pt-4">
        {confirm
          ? (
              <View className="gap-4">
                <Text className="text-base text-ink">Check {email} for a confirmation link, then sign in.</Text>
                <Button label="Back to sign in" onPress={() => router.replace('/sign-in')} />
              </View>
            )
          : (
              <>
                <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" hint="Shown to people you share a library with" />
                <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
                <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
                {error && <Text className="text-center text-sm text-negative">{error}</Text>}
                <Button big label="Create account" onPress={onSubmit} loading={busy} disabled={!name.trim() || !email || !password} />
              </>
            )}
      </KeyboardAvoidingView>
    </SafeArea>
  )
}
