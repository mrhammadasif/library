import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Text, View } from 'react-native'
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
  id: string
  token: string
  userAgent?: string | null
  updatedAt: string | Date
  createdAt: string | Date
}

function deviceName(userAgent?: string | null): string {
  if (!userAgent) {
    return 'Unknown device'
  }
  // This app: "HomeLibrary/1.0.0 (Google Pixel 8; Android 14)"
  const app = userAgent.match(/^HomeLibrary\/\S+ \((.+); (.+)\)$/)
  if (app) {
    return `${app[1]} · ${app[2]}`
  }
  if (/^okhttp\//i.test(userAgent)) {
    return 'Android phone (older app version)'
  }
  if (/^(node|curl|undici|python|axios)/i.test(userAgent)) {
    return 'A script or tool'
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

  function signOutOthers() {
    Alert.alert('Sign out everywhere else?', 'Every other phone, tablet or browser will need to sign in again. This one stays signed in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out others',
        style: 'destructive',
        onPress: async () => {
          const { error } = await authClient.revokeOtherSessions()
          if (error) {
            toast(errorMessage(error), '⚠️')
            return
          }
          toast('Signed out everywhere else', '👋')
          client.invalidateQueries({ queryKey: ['sessions'] })
        },
      },
    ])
  }

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
      {(sessions.data?.length ?? 0) > 1 && (
        <Button variant="danger" icon="log-out" label="Sign out all other devices" onPress={signOutOthers} />
      )}
      {/* This device first; compare by session id (the Expo client doesn't expose the same token string). */}
      {[...(sessions.data ?? [])].sort((a, b) => Number(b.id === current.data?.session.id) - Number(a.id === current.data?.session.id)).map((s) => {
        const isThis = s.id === current.data?.session.id
        return (
          <Card key={s.token} className="gap-2 py-4">
            <View className="flex-row items-center gap-3">
              <Text className="text-3xl">📱</Text>
              <View className="flex-1">
                <Text className="text-lg font-bold text-ink">{deviceName(s.userAgent)}</Text>
                {isThis && <Text className="text-sm font-bold text-positive">✓ This device</Text>}
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
