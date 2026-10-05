import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { getColors } from 'react-native-image-colors'
import { getSupabase } from '~/api/Supabase'

/** Downscales a photo to ≤768px wide JPEG: small enough for AI vision calls and cover storage. */
export async function prepareImage(uri: string): Promise<{ uri: string, base64: string }> {
  const rendered = await ImageManipulator.manipulate(uri).resize({ width: 768 }).renderAsync()
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true })
  return { uri: saved.uri, base64: saved.base64 ?? '' }
}

/** Uploads a local JPEG as a book cover; returns its storage path. A fresh path per upload busts image caches. */
export async function uploadCover(libraryId: string, bookId: string, localUri: string): Promise<string> {
  const path = `${libraryId}/${bookId}-${Date.now()}.jpg`
  const body = await (await fetch(localUri)).arrayBuffer()
  const { error } = await getSupabase().storage.from('covers').upload(path, body, { contentType: 'image/jpeg', upsert: true })
  if (error) {
    throw error
  }
  return path
}

/** Dominant colour of a cover (local or remote), or null when it can't be read. */
export async function dominantColor(uri: string): Promise<string | null> {
  try {
    const colors = await getColors(uri, { fallback: '#000000', cache: true, key: uri.slice(-200) })
    const hex = colors.platform === 'ios' ? colors.background : colors.dominant
    return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toUpperCase() : null
  }
  catch {
    return null
  }
}
