import { Share } from 'react-native'

export function shareInvite(libraryName: string, code: string) {
  return Share.share({
    message: `Join my "${libraryName}" library in the Home Library app. Sign up, then enter this invite code: ${code}`,
  })
}
