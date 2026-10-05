import type { BottomTabBarProps } from 'expo-router/tabs'
import type { ComponentProps } from 'react'
import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { Colors } from '~/constants/Colors'
import { useCan } from '~/library/LibraryProvider'

const TABS: Record<string, { label: string, icon: ComponentProps<typeof Feather>['name'] }> = {
  index: { label: 'Home', icon: 'home' },
  shelves: { label: 'Shelves', icon: 'layers' },
  search: { label: 'Search', icon: 'search' },
  reports: { label: 'Reports', icon: 'bar-chart-2' },
}

/** Home · Shelves · (scan) · Search · Reports — the centre button scans a new book (needs books.add). */
export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const canAdd = useCan('books.add')

  function renderTab(index: number) {
    const route = state.routes[index]
    const focused = state.index === index
    const tab = TABS[route.name]
    const color = focused ? Colors.primary : Colors.faint
    return (
      <Pressable
        key={route.key}
        className="flex-1 items-center gap-1 pt-3"
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name)
          }
        }}
      >
        <Feather name={tab.icon} size={22} color={color} />
        <Text className="text-xs font-medium" style={{ color }}>{tab.label}</Text>
      </Pressable>
    )
  }

  return (
    <View
      className="absolute bottom-0 left-0 right-0 flex-row border-t border-line bg-card"
      style={{ paddingBottom: Math.max(insets.bottom, 10) }}
    >
      {renderTab(0)}
      {renderTab(1)}
      <View className="w-20 items-center">
        {canAdd && (
          <Pressable
            onPress={() => router.push('/add/scan')}
            className="-mt-6 h-16 w-16 items-center justify-center rounded-full bg-primary"
            style={{ shadowColor: Colors.walnut, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}
          >
            <Feather name="maximize" size={28} color="#fff" />
          </Pressable>
        )}
      </View>
      {renderTab(2)}
      {renderTab(3)}
    </View>
  )
}
