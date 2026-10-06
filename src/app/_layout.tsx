import '~/global.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from '~/auth/AuthProvider'
import { ToastProvider } from '~/components/Toast'
import { Colors } from '~/constants/Colors'
import { LibraryProvider, useLibrary } from '~/library/LibraryProvider'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
})

const SHEET = { presentation: 'formSheet' as const, sheetAllowedDetents: [0.7, 1], sheetCornerRadius: 24 }

function RootStack() {
  const { status, user } = useAuth()
  const { loading, current } = useLibrary()
  const signedIn = status === 'signedIn'
  // Unverified accounts are read-only on the server, so they only see the "type your code" screen.
  const verified = signedIn && !!user?.emailVerified
  const ready = status !== 'loading' && !(verified && loading)

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync()
    }
  }, [ready])

  if (!ready) {
    return null
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.canvas } }}>
      <Stack.Protected guard={verified && !!current}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add/scan" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="add/photo" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="add/review" />
        <Stack.Screen name="book/[id]" />
        <Stack.Screen name="book/edit/[id]" />
        <Stack.Screen name="shelf/[id]" />
        <Stack.Screen name="rack/[id]" />
        <Stack.Screen name="lend/[bookId]" options={SHEET} />
        <Stack.Screen name="audit/play/[id]" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="move" options={SHEET} />
        <Stack.Screen name="donate" options={SHEET} />
        <Stack.Screen name="loans" />
        <Stack.Screen name="archive" />
        <Stack.Screen name="audit/index" />
        <Stack.Screen name="audit/[id]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="members" />
        <Stack.Screen name="member/[userId]" />
        <Stack.Screen name="invite" options={SHEET} />
        <Stack.Screen name="ai-settings" />
      </Stack.Protected>
      <Stack.Protected guard={verified}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="devices" />
        <Stack.Screen name="delete-account" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !verified}>
        <Stack.Screen name="verify-email" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="sign-in-code" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LibraryProvider>
          <ToastProvider>
            <StatusBar style="dark" />
            <RootStack />
          </ToastProvider>
        </LibraryProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
