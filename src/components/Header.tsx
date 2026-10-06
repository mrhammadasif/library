import type { ReactNode } from 'react'
import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { Colors } from '~/constants/Colors'

interface IHeaderProps {
  title: string
  subtitle?: string
  right?: ReactNode
  /** Close (×) instead of back (‹), for modals. */
  close?: boolean
}

/** Stack-screen header: back/close, title and optional actions. */
export function Header({ title, subtitle, right, close = false }: IHeaderProps) {
  return (
    <View className="flex-row items-center gap-3 px-5 pb-3 pt-2">
      <Pressable
        hitSlop={10}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityRole="button"
        accessibilityLabel={close ? 'Close' : 'Back'}
        className="h-12 w-12 items-center justify-center rounded-2xl border-2 border-line bg-card"
      >
        <Feather name={close ? 'x' : 'chevron-left'} size={26} color={Colors.ink} />
      </Pressable>
      <View className="flex-1">
        <Text className="text-2xl font-bold text-ink" numberOfLines={1}>{title}</Text>
        {subtitle && <Text className="text-base text-muted" numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  )
}
