import type { BottomTabBarProps } from 'expo-router/tabs'
import type { ComponentProps } from 'react'
import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { Colors } from '~/constants/Colors'

const TABS: Record<string, { label: string, icon: ComponentProps<typeof Feather>['name'] }> = {
  index: { label: 'Home', icon: 'home' },
  shelves: { label: 'Shelves', icon: 'layers' },
  search: { label: 'Find', icon: 'search' },
  reports: { label: 'Stats', icon: 'bar-chart-2' },
}

/** Home · Shelves · (Scan) · Find · Stats. The big centre button scans any book: new ones get added, known ones show where they go. */
export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  function renderTab(index: number) {
    const route = state.routes[index]
    const focused = state.index === index
    const tab = TABS[route.name]
    const color = focused ? Colors.primary : Colors.muted
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityLabel={tab.label}
        accessibilityState={{ selected: focused }}
        className="min-h-14 flex-1 items-center gap-1 pt-3"
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name)
          }
        }}
      >
        <Feather name={tab.icon} size={26} color={color} />
        <Text className={`text-sm ${focused ? 'font-bold' : 'font-medium'}`} style={{ color }}>{tab.label}</Text>
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
      <View className="w-24 items-center">
        <Pressable
          onPress={() => router.push('/add/scan')}
          accessibilityRole="button"
          accessibilityLabel="Scan a book"
          className="-mt-8 h-20 w-20 items-center justify-center rounded-full border-4 border-card bg-primary active:opacity-80"
          style={{ shadowColor: Colors.walnut, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}
        >
          <Feather name="maximize" size={32} color="#fff" />
        </Pressable>
        <Text className="mt-0.5 text-sm font-bold text-primary">Scan</Text>
      </View>
      {renderTab(2)}
      {renderTab(3)}
    </View>
  )
}
