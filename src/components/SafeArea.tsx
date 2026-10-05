import type { ReactNode } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type Edge = 'top' | 'bottom'

/**
 * Safe-area container that accepts `className`. react-native-safe-area-context's SafeAreaView isn't
 * a core component, so NativeWind's className polyfill silently ignores styles on it.
 */
export function SafeArea({ edges = ['top', 'bottom'], className, children }: { edges?: Edge[], className?: string, children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <View
      className={className}
      style={{ paddingTop: edges.includes('top') ? insets.top : 0, paddingBottom: edges.includes('bottom') ? insets.bottom : 0 }}
    >
      {children}
    </View>
  )
}
