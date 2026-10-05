import type { Permission } from '~/constants/Permissions'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { Button } from '~/components/Button'
import { Empty, Loading } from '~/components/EmptyState'
import { Header } from '~/components/Header'
import { PermissionEditor } from '~/components/PermissionEditor'
import { Screen } from '~/components/Screen'
import { useMembers, useRemoveMember, useSetMemberPermissions, useSetOwner } from '~/hooks/Members'
import { useCurrentLibrary } from '~/library/LibraryProvider'
import { errorMessage } from '~/utils/Errors'

/** Toggle a member's permissions, remove them, or (owners only) make them an owner. */
export default function MemberScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>()
  const current = useCurrentLibrary()
  const members = useMembers(current.library.id)
  const member = members.data?.find(m => m.userId === userId)
  const save = useSetMemberPermissions()
  const remove = useRemoveMember()
  const setOwner = useSetOwner()
  const [draft, setDraft] = useState<Permission[] | null>(null)
  const isOwner = current.role === 'owner'

  if (!member) {
    return <Screen header={<Header title="Member" />}>{members.isPending ? <Loading /> : <Empty text="No longer a member." />}</Screen>
  }
  const permissions = draft ?? member.permissions
  const changed = draft !== null && [...draft].sort().join() !== [...member.permissions].sort().join()
  const libraryId = current.library.id
  const error = save.error ?? remove.error ?? setOwner.error

  function confirm(title: string, message: string, action: () => void) {
    Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', style: 'destructive', onPress: action }])
  }

  return (
    <Screen header={<Header title={member.displayName} subtitle={member.role === 'owner' ? 'Owner' : 'Member'} />}>
      {member.role === 'owner'
        ? <Text className="text-base text-muted">Owners can do everything in this library.</Text>
        : (
            <>
              <PermissionEditor value={permissions} onChange={setDraft} grantable={current.permissions} />
              <Button
                label="Save permissions"
                icon="check"
                disabled={!changed}
                loading={save.isPending}
                onPress={() => save.mutate({ libraryId, userId, permissions }, { onSuccess: () => setDraft(null) })}
              />
            </>
          )}
      {error && <Text className="text-center text-sm text-negative">{errorMessage(error)}</Text>}
      <View className="gap-3">
        {isOwner && (
          <Button
            variant="secondary"
            icon="star"
            label={member.role === 'owner' ? 'Remove owner role' : 'Make owner'}
            loading={setOwner.isPending}
            onPress={() => confirm(
              member.role === 'owner' ? 'Remove owner role?' : 'Make owner?',
              member.role === 'owner' ? 'They keep every permission but can\'t delete the library or change owners.' : 'Owners have full control, including deleting the library.',
              () => setOwner.mutate({ libraryId, userId, owner: member.role !== 'owner' }),
            )}
          />
        )}
        {(member.role !== 'owner' || isOwner) && (
          <Button
            variant="danger"
            icon="user-x"
            label="Remove from library"
            loading={remove.isPending}
            onPress={() => confirm('Remove member?', `${member.displayName} will lose access to this library.`, () =>
              remove.mutate({ libraryId, userId }, { onSuccess: () => router.back() }))}
          />
        )}
      </View>
    </Screen>
  )
}
