import type { Permission } from '~/constants/Permissions'
import * as Clipboard from 'expo-clipboard'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { Chip } from '~/components/Chip'
import { PermissionEditor } from '~/components/PermissionEditor'
import { Screen } from '~/components/Screen'
import { useCreateInvite } from '~/hooks/Members'
import { useCurrentLibrary } from '~/library/LibraryProvider'
import { errorMessage } from '~/utils/Errors'
import { shareInvite } from '~/utils/Invite'

/** Create an invite code that carries a permission set. */
export default function InviteScreen() {
  const current = useCurrentLibrary()
  const create = useCreateInvite()
  const [permissions, setPermissions] = useState<Permission[]>(['loans.manage'])
  // Defaults to the Reader preset: the most common invite is a family member who borrows books.
  const [days, setDays] = useState(7)
  const [maxUses, setMaxUses] = useState(1)

  if (create.data) {
    return (
      <Screen>
        <Card className="items-center gap-3 py-6">
          <Text className="text-base text-muted">Invite code</Text>
          <Text selectable className="text-4xl font-bold tracking-widest text-ink">{create.data}</Text>
          <Text className="text-center text-sm text-muted">They sign up in the app, then enter this code on the welcome screen.</Text>
        </Card>
        <Button icon="share-2" label="Share invite" onPress={() => shareInvite(current.library.name, create.data!)} />
        <Button variant="secondary" icon="copy" label="Copy code" onPress={() => Clipboard.setStringAsync(create.data!)} />
      </Screen>
    )
  }

  return (
    <Screen>
      <Text className="pt-4 text-2xl font-bold text-ink">Invite someone</Text>
      <Text className="text-lg font-bold text-ink">What can they do?</Text>
      <PermissionEditor value={permissions} onChange={setPermissions} grantable={current.permissions} />
      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted">Code expires in</Text>
        <View className="flex-row gap-2">
          {[1, 7, 30].map(d => <Chip key={d} label={d === 1 ? '1 day' : `${d} days`} selected={days === d} onPress={() => setDays(d)} />)}
        </View>
        <Text className="text-sm font-semibold text-muted">Can be used by</Text>
        <View className="flex-row gap-2">
          {[1, 5, 20].map(n => <Chip key={n} label={n === 1 ? '1 person' : `${n} people`} selected={maxUses === n} onPress={() => setMaxUses(n)} />)}
        </View>
      </View>
      {create.error && <Text className="text-center text-sm text-negative">{errorMessage(create.error)}</Text>}
      <Button
        label="Create invite code"
        icon="user-plus"
        loading={create.isPending}
        onPress={() => create.mutate({ libraryId: current.library.id, permissions, days, maxUses })}
      />
    </Screen>
  )
}
