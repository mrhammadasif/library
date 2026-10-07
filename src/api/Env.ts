import Constants from 'expo-constants'
import { Platform } from 'react-native'

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set (see .env.example)`)
  }
  return value.replace(/\/+$/, '')
}

// EXPO_PUBLIC_* must be read with literal names so Metro inlines them at build time.
export const API_URL = required('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL)
export const COVERS_URL = required('EXPO_PUBLIC_COVERS_URL', process.env.EXPO_PUBLIC_COVERS_URL)
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? ''

/**
 * Sent as User-Agent so the Devices screen can say "Home Library on Pixel 8 (Android 14)" instead of the HTTP library's
 * own name (okhttp/4.9.2).
 */
export const USER_AGENT = (() => {
  const c = Platform.constants as { Manufacturer?: string, Model?: string, Release?: string }
  const device = [c.Manufacturer, c.Model].filter(Boolean).join(' ') || Platform.OS
  const os = Platform.OS === 'android' ? `Android ${c.Release ?? Platform.Version}` : `${Platform.OS} ${Platform.Version}`
  return `HomeLibrary/${Constants.expoConfig?.version ?? '1'} (${device}; ${os})`
})()
