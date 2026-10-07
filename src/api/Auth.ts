import { expoClient } from '@better-auth/expo/client'
import { emailOTPClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import * as SecureStore from 'expo-secure-store'
import { API_URL, USER_AGENT } from '~/api/Env'

/** Better Auth client: the session cookie lives in SecureStore; every API request sends it (see Http.ts). */
export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: '/api/auth',
  fetchOptions: { headers: { 'User-Agent': USER_AGENT } },
  plugins: [
    expoClient({ scheme: 'homelibrary', storagePrefix: 'homelibrary', storage: SecureStore }),
    emailOTPClient(),
  ],
})
