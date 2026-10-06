import { GoogleOneTapSignIn, isCancelledResponse, isNoSavedCredentialFoundResponse, isSuccessResponse } from 'react-native-nitro-google-signin'
import { GOOGLE_WEB_CLIENT_ID } from '~/api/Env'

let configured = false

/**
 * Android Credential Manager sign-in: saved account (one tap) → new account → full account picker.
 * Returns the Google ID token (audience = the web client), or null if the user backed out.
 */
export async function signInWithGoogleNative(): Promise<string | null> {
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error('Google sign-in isn\'t set up in this build (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)')
  }
  if (!configured) {
    GoogleOneTapSignIn.configure({ webClientId: GOOGLE_WEB_CLIENT_ID })
    configured = true
  }
  await GoogleOneTapSignIn.checkPlayServices()
  let response = await GoogleOneTapSignIn.signIn()
  if (isNoSavedCredentialFoundResponse(response)) {
    response = await GoogleOneTapSignIn.createAccount()
  }
  if (isNoSavedCredentialFoundResponse(response)) {
    response = await GoogleOneTapSignIn.presentExplicitSignIn()
  }
  if (isCancelledResponse(response) || !isSuccessResponse(response)) {
    return null
  }
  return response.data.idToken
}
