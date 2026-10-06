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
