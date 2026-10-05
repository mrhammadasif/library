import type { ReactNode } from 'react'
import { View } from 'react-native'

/** White bordered card on the canvas. */
export function Card({ children, className = '' }: { children: ReactNode, className?: string }) {
  return <View className={`rounded-2xl border border-line bg-card px-4 ${className}`}>{children}</View>
}
