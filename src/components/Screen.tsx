import type { ReactNode } from 'react'
import { RefreshControl, ScrollView } from 'react-native'
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
      <ScrollView
        contentContainerClassName={`gap-5 px-5 pt-2 ${tabs ? 'pb-36' : 'pb-16'}`}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
      >
        {children}
      </ScrollView>
    </SafeArea>
  )
}
