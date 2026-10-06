import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Text, View } from 'react-native'
import { authClient } from '~/api/Auth'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { ErrorState, Loading } from '~/components/EmptyState'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { useToast } from '~/components/Toast'
import { formatRelative } from '~/utils/Dates'
import { errorMessage } from '~/utils/Errors'

interface ISession {
  token: string
  userAgent?: string | null
  updatedAt: string | Date
  createdAt: string | Date
}

function deviceName(userAgent?: string | null): string {
  if (!userAgent) {
    return 'Unknown device'
  }
  if (/android/i.test(userAgent)) {
    return 'Android phone or tablet'
  }
  if (/iphone|ipad|ios/i.test(userAgent)) {
    return 'iPhone or iPad'
  }
  return userAgent.slice(0, 40)
}

/** Where you're signed in; sign out a lost phone. */
export default function DevicesScreen() {
  const client = useQueryClient()
  const toast = useToast()
  const current = authClient.useSession()
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const { data, error } = await authClient.listSessions()
      if (error) {
        throw new Error(error.message)
      }
      return (data ?? []) as unknown as ISession[]
    },
  })

  async function signOutDevice(token: string) {
    const { error } = await authClient.revokeSession({ token })
    if (error) {
      toast(errorMessage(error), '⚠️')
      return
    }
    toast('Signed out that device', '👋')
    client.invalidateQueries({ queryKey: ['sessions'] })
  }

  return (
    <Screen header={<Header title="Your devices" subtitle="Where you're signed in" />} refreshing={sessions.isRefetching} onRefresh={sessions.refetch}>
      {sessions.isPending && <Loading />}
      {sessions.error && <ErrorState error={sessions.error} onRetry={sessions.refetch} />}
      {sessions.data?.map((s) => {
        const isThis = s.token === current.data?.session.token
        return (
          <Card key={s.token} className="gap-2 py-4">
            <View className="flex-row items-center gap-3">
              <Text className="text-3xl">📱</Text>
              <View className="flex-1">
                <Text className="text-lg font-bold text-ink">{deviceName(s.userAgent)}{isThis ? ' (this one)' : ''}</Text>
                <Text className="text-base text-muted">Last used {formatRelative(new Date(s.updatedAt).toISOString())}</Text>
              </View>
            </View>
            {!isThis && <Button small variant="danger" icon="log-out" label="Sign out this device" onPress={() => signOutDevice(s.token)} />}
          </Card>
        )
      })}
    </Screen>
  )
}
