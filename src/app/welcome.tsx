import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useAuth } from '~/auth/AuthProvider'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { Field } from '~/components/Field'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { useAcceptInvite, useCreateLibrary } from '~/hooks/Libraries'
import { useLibrary } from '~/library/LibraryProvider'
import { errorMessage } from '~/utils/Errors'

/** Create a library or join one with an invite code. First screen for users without a library. */
export default function WelcomeScreen() {
  const { signOut } = useAuth()
  const { current, select } = useLibrary()
  const create = useCreateLibrary()
  const join = useAcceptInvite()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  const [joinedId, setJoinedId] = useState<string | null>(null)

  // Navigate once the new library shows up in the memberships, so the "has a library" route guard lets us in.
  useEffect(() => {
    if (joinedId && current?.library.id === joinedId) {
      router.replace('/')
    }
  }, [joinedId, current])

  function done(libraryId: string) {
    select(libraryId)
    setJoinedId(libraryId)
  }

  return (
    <Screen
      header={current
        ? <Header title="Add a library" />
        : (
            <View className="gap-2 px-5 pb-2 pt-6">
              <Text className="text-3xl font-bold text-ink">Welcome</Text>
              <Text className="text-base text-muted">{'Start your own library, or join a family member\'s with their invite code.'}</Text>
            </View>
          )}
    >
      <Card className="gap-3 py-4">
        <Text className="text-lg font-bold text-ink">Start a library</Text>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Home, Office" />
        {create.error && <Text className="text-sm text-negative">{errorMessage(create.error)}</Text>}
        <Button
          label="Create library"
          icon="plus"
          loading={create.isPending}
          disabled={!name.trim()}
          onPress={() => create.mutate(name, { onSuccess: done })}
        />
      </Card>
      <Card className="gap-3 py-4">
        <Text className="text-lg font-bold text-ink">Join with a code</Text>
        <Field label="Invite code" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="ABCD2345" />
        {join.error && <Text className="text-sm text-negative">{errorMessage(join.error)}</Text>}
        <Button
          label="Join library"
          icon="user-plus"
          variant="secondary"
          loading={join.isPending}
          disabled={code.trim().length < 8}
          onPress={() => join.mutate(code, { onSuccess: done })}
        />
      </Card>
      {!current && <Button label="Sign out" variant="ghost" onPress={signOut} />}
    </Screen>
  )
}
