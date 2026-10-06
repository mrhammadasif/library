import { router } from 'expo-router'
import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { useAuth } from '~/auth/AuthProvider'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { Field } from '~/components/Field'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { SettingsCard, SettingsRow } from '~/components/SettingsCard'
import { describePermissions } from '~/constants/Permissions'
import { useDeleteLibrary, useRenameLibrary } from '~/hooks/Libraries'
import { useProfile, useRemoveMember, useUpdateDisplayName } from '~/hooks/Members'
import { useCan, useCurrentLibrary, useLibrary } from '~/library/LibraryProvider'
import { errorMessage } from '~/utils/Errors'

export default function SettingsScreen() {
  const { user, signOut } = useAuth()
  const { memberships, select } = useLibrary()
  const current = useCurrentLibrary()
  const { library } = current
  const isOwner = current.role === 'owner'
  const canMembers = useCan('members.manage')
  const canAi = useCan('ai.manage')
  const profile = useProfile(user?.id)
  const rename = useRenameLibrary()
  const remove = useDeleteLibrary()
  const leave = useRemoveMember()
  const updateName = useUpdateDisplayName()
  const [libraryName, setLibraryName] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)

  function confirmDelete() {
    Alert.alert(`Delete "${library.name}"?`, 'Every book, shelf, loan and audit in it is deleted for all members. This can\'t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete library', style: 'destructive', onPress: () => remove.mutate(library.id) },
    ])
  }

  function confirmLeave() {
    Alert.alert(`Leave "${library.name}"?`, 'You\'ll need a new invite code to join again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => leave.mutate({ libraryId: library.id, userId: user!.id }) },
    ])
  }

  const error = rename.error ?? remove.error ?? leave.error ?? updateName.error
  return (
    <Screen header={<Header title="Settings" />}>
      <SettingsCard title="Your libraries">
        {memberships.map(m => (
          <SettingsRow
            key={m.library.id}
            icon={m.library.id === library.id ? 'check-circle' : 'circle'}
            label={m.library.name}
            hint={m.role === 'owner' ? 'Owner' : describePermissions(m.permissions)}
            onPress={() => {
              select(m.library.id)
              router.back()
            }}
          />
        ))}
        <SettingsRow icon="plus" label="Create or join a library" onPress={() => router.push('/welcome')} last />
      </SettingsCard>

      <SettingsCard title={library.name}>
        <SettingsRow icon="users" label="Members" hint={canMembers ? 'Invite family and choose what they can do' : 'Who uses this library'} onPress={() => router.push('/members')} />
        <SettingsRow icon="book-open" label="Borrowed books" onPress={() => router.push('/loans')} />
        <SettingsRow icon="gift" label="Given away" hint="Books that left the shelves" onPress={() => router.push('/archive')} />
        <SettingsRow icon="check-square" label="Book checks" onPress={() => router.push('/audit')} />
        <SettingsRow
          icon="cpu"
          label="Smart helpers (AI)"
          hint={[library.enrichProvider && 'Tag ideas on', library.visionProvider && 'Cover photos on'].filter(Boolean).join(' · ') || (canAi ? 'Off: tap to set up' : 'Off')}
          onPress={canAi ? () => router.push('/ai-settings') : undefined}
          last
        />
      </SettingsCard>

      {isOwner && (libraryName === null
        ? <Button variant="secondary" icon="edit-3" label="Rename library" onPress={() => setLibraryName(library.name)} />
        : (
            <Card className="gap-3 py-4">
              <Field label="Library name" value={libraryName} onChangeText={setLibraryName} autoFocus />
              <Button
                label="Save"
                loading={rename.isPending}
                disabled={!libraryName.trim()}
                onPress={() => rename.mutate({ libraryId: library.id, name: libraryName }, { onSuccess: () => setLibraryName(null) })}
              />
            </Card>
          ))}

      <SettingsCard title="You">
        <SettingsRow icon="user" label={profile.data?.display_name ?? '…'} hint={user?.email} onPress={() => setDisplayName(profile.data?.display_name ?? '')} />
        <SettingsRow icon="log-out" label="Sign out" onPress={signOut} last />
      </SettingsCard>
      {displayName !== null && (
        <Card className="gap-3 py-4">
          <Field label="Your name" value={displayName} onChangeText={setDisplayName} autoFocus />
          <Button
            label="Save"
            loading={updateName.isPending}
            disabled={!displayName.trim()}
            onPress={() => updateName.mutate({ userId: user!.id, name: displayName }, { onSuccess: () => setDisplayName(null) })}
          />
        </Card>
      )}

      {error && <Text className="text-center text-sm text-negative">{errorMessage(error)}</Text>}
      <View className="gap-3">
        <Button variant="danger" icon="log-out" label="Leave this library" onPress={confirmLeave} />
        {isOwner && <Button variant="danger" icon="trash-2" label="Delete this library" onPress={confirmDelete} />}
      </View>
    </Screen>
  )
}
