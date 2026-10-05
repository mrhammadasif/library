import { Tabs } from 'expo-router/tabs'
import { TabBar } from '~/components/TabBar'
import { Colors } from '~/constants/Colors'

export default function TabsLayout() {
  return (
    <Tabs tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: Colors.canvas } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="shelves" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="reports" />
    </Tabs>
  )
}
