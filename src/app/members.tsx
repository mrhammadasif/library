import * as Clipboard from 'expo-clipboard'
import { router } from 'expo-router'
import { Text, View } from 'react-native'
import { useAuth } from '~/auth/AuthProvider'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { ErrorState, Loading } from '~/components/EmptyState'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { SectionHeader } from '~/components/SectionHeader'
import { SettingsCard, SettingsRow } from '~/components/SettingsCard'
import { describePermissions } from '~/constants/Permissions'
import { useDeleteInvite, useInvites, useMembers } from '~/hooks/Members'
import { useCan, useCurrentLibrary } from '~/library/LibraryProvider'
import { formatRelative } from '~/utils/Dates'
import { shareInvite } from '~/utils/Invite'

export default function MembersScreen() {
  const { library } = useCurrentLibrary()
  const { user } = useAuth()
  const canManage = useCan('members.manage')
  const members = useMembers(library.id)
  const invites = useInvites(library.id, canManage)
  const deleteInvite = useDeleteInvite()

  return (
    <Screen header={<Header title="Members" subtitle={library.name} />} refreshing={members.isRefetching} onRefresh={members.refetch}>
      {canManage && <Button icon="user-plus" label="Invite someone" onPress={() => router.push('/invite')} />}

      {members.isPending && <Loading />}
      {members.error && <ErrorState error={members.error} onRetry={members.refetch} />}
      {members.data && (
        <SettingsCard>
          {members.data.map((m, i) => (
            <SettingsRow
              key={m.userId}
              icon={m.role === 'owner' ? 'star' : 'user'}
              label={`${m.displayName}${m.userId === user?.id ? ' (you)' : ''}`}
              hint={m.role === 'owner' ? 'Owner: full access' : describePermissions(m.permissions)}
              onPress={canManage && m.userId !== user?.id ? () => router.push({ pathname: '/member/[userId]', params: { userId: m.userId } }) : undefined}
              last={i === members.data.length - 1}
            />
          ))}
        </SettingsCard>
      )}

      {canManage && (invites.data?.length ?? 0) > 0 && (
        <View className="gap-3">
          <SectionHeader title="Open invites" />
          {invites.data!.map(invite => (
            <Card key={invite.id} className="gap-2 py-3">
              <Text selectable className="text-2xl font-bold tracking-widest text-ink">{invite.code}</Text>
              <Text className="text-sm text-muted">
                {describePermissions(invite.permissions)} · expires {formatRelative(invite.expiresAt)} · {invite.maxUses - invite.uses} use(s) left
              </Text>
              <View className="flex-row gap-2">
                <View className="flex-1"><Button small icon="share-2" label="Share" onPress={() => shareInvite(library.name, invite.code)} /></View>
                <View className="flex-1"><Button small variant="secondary" icon="copy" label="Copy" onPress={() => Clipboard.setStringAsync(invite.code)} /></View>
                <View className="flex-1"><Button small variant="danger" label="Revoke" onPress={() => deleteInvite.mutate(invite.id)} /></View>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  )
}
