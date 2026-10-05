import * as ImagePicker from 'expo-image-picker'
import { prepareImage } from '~/utils/ImagePrep'

/** Takes or picks a photo, downscaled to a ≤768px JPEG. Null when cancelled or permission denied. */
export async function captureCover(source: 'camera' | 'gallery'): Promise<{ uri: string, base64: string } | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      return null
    }
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [2, 3], quality: 0.9 }
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options)
  if (result.canceled || !result.assets[0]) {
    return null
  }
  return prepareImage(result.assets[0].uri)
}
