import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { BarcodeScanner } from '~/components/BarcodeScanner'
import { SafeArea } from '~/components/SafeArea'
import { useCurrentLibrary } from '~/library/LibraryProvider'

/** Scan a barcode to add a book; each scan opens the pre-filled review form. */
export default function ScanScreen() {
  const { library } = useCurrentLibrary()

  return (
    <SafeArea className="flex-1 bg-walnut">
      <View className="flex-row items-center justify-between px-5 py-3">
        <Pressable hitSlop={10} onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-xl bg-walnut-soft">
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
        <Text className="text-lg font-bold text-white">Add a book</Text>
        <View className="w-10" />
      </View>
      <View className="mx-3 flex-1 overflow-hidden rounded-3xl">
        <BarcodeScanner onIsbn={isbn => router.push({ pathname: '/add/review', params: { isbn, from: 'scan' } })} />
      </View>
      <View className="flex-row gap-3 px-5 py-4">
        <Pressable
          onPress={() => router.push('/add/photo')}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-walnut-soft py-4"
        >
          <Feather name="camera" size={18} color="#fff" />
          <Text className="font-semibold text-white">{library.visionProvider ? 'Photo of cover' : 'Photo (needs AI)'}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/add/review', params: { from: 'scan' } })}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-walnut-soft py-4"
        >
          <Feather name="edit-3" size={18} color="#fff" />
          <Text className="font-semibold text-white">Type it in</Text>
        </Pressable>
      </View>
    </SafeArea>
  )
}
