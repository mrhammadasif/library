import type { ReactNode } from 'react'
import { RefreshControl } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { SafeArea } from '~/components/SafeArea'

interface IScreenProps {
  children: ReactNode
  refreshing?: boolean
  onRefresh?: () => void
  /** Rendered above the scroll view (e.g. a Header). */
  header?: ReactNode
  /** Extra bottom padding for tab screens (the tab bar overlaps content). */
  tabs?: boolean
}

export function Screen({ children, refreshing = false, onRefresh, header, tabs = false }: IScreenProps) {
  return (
    <SafeArea edges={['top']} className="flex-1 bg-canvas">
      {header}
      {/* Scrolls the focused input above the keyboard (Android edge-to-edge doesn't resize the window).
          Not a core component, so NativeWind's contentContainerClassName doesn't apply: gap-5 px-5 pt-2 pb-36/pb-16. */}
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{ gap: 20, paddingHorizontal: 20, paddingTop: 8, paddingBottom: tabs ? 144 : 64 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // Android form sheets (invite, lend, move, give away) are Material bottom sheets: without nested scrolling the
        // sheet grabs every drag and the content can't scroll. Harmless on full screens.
        nestedScrollEnabled
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
      >
        {children}
      </KeyboardAwareScrollView>
    </SafeArea>
  )
}
