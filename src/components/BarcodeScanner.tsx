import type { BarcodeScanningResult } from 'expo-camera'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { Button } from '~/components/Button'
import { normalizeIsbn } from '~fn/isbn'

interface IBarcodeScannerProps {
  /** Called once per distinct valid ISBN; the same code is ignored for a few seconds. */
  onIsbn: (isbn13: string) => void
  paused?: boolean
  hint?: string
}

/** Full-bleed camera that reads EAN-13/UPC barcodes and reports valid ISBNs only. */
export function BarcodeScanner({ onIsbn, paused = false, hint = 'Point at the barcode on the back cover' }: IBarcodeScannerProps) {
  const [permission, requestPermission] = useCameraPermissions()
  const [torch, setTorch] = useState(false)
  const last = useRef<{ code: string, at: number } | null>(null)

  if (!permission) {
    return <View className="flex-1 bg-black" />
  }
  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-walnut p-8">
        <Text className="text-center text-base text-white">The camera is needed to scan barcodes.</Text>
        <Button label="Allow camera" onPress={requestPermission} />
      </View>
    )
  }

  function onScanned(result: BarcodeScanningResult) {
    if (paused) {
      return
    }
    const isbn = normalizeIsbn(result.data)
    if (!isbn) {
      return
    }
    const now = Date.now()
    if (last.current && last.current.code === isbn.isbn13 && now - last.current.at < 4000) {
      return
    }
    last.current = { code: isbn.isbn13, at: now }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    onIsbn(isbn.isbn13)
  }

  return (
    <View className="flex-1 overflow-hidden bg-black">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'upc_a'] }}
        onBarcodeScanned={paused ? undefined : onScanned}
      />
      <View pointerEvents="box-none" className="absolute inset-0 items-center justify-center">
        <View className="h-40 w-72 rounded-3xl border-2 border-white" />
        <Text className="mt-4 rounded-full bg-[#00000080] px-4 py-1.5 text-sm text-white">{hint}</Text>
      </View>
      <View className="absolute bottom-4 right-4">
        <Button small variant="secondary" icon={torch ? 'zap-off' : 'zap'} label={torch ? 'Light off' : 'Light'} onPress={() => setTorch(!torch)} />
      </View>
    </View>
  )
}
