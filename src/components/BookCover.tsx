import { Image } from 'expo-image'
import { Text, View } from 'react-native'
import { coverUri } from '~/api/Http'
import { Colors } from '~/constants/Colors'

interface IBookCoverProps {
  title: string
  coverPath?: string | null
  coverUrl?: string | null
  /** A local or resolved URI; takes precedence over path/url. */
  uri?: string | null
  color?: string | null
  width?: number
}

/** Cover image at a 2:3 ratio; falls back to a spine-coloured block with the title's initials. */
export function BookCover({ title, coverPath = null, coverUrl = null, uri, color, width = 48 }: IBookCoverProps) {
  const source = uri ?? coverUri(coverPath, coverUrl)
  const height = Math.round(width * 1.5)
  const initials = title.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('')
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-md border border-line"
      style={{ width, height, backgroundColor: color ?? Colors.primarySoft }}
    >
      {source
        ? <Image source={{ uri: source }} style={{ width, height }} contentFit="cover" transition={150} recyclingKey={source} />
        : <Text className="font-bold text-white" style={{ fontSize: width / 3, color: color ? '#FFFFFF' : Colors.primary }}>{initials}</Text>}
    </View>
  )
}
