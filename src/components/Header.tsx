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
        className="h-10 w-10 items-center justify-center rounded-xl border border-line bg-card"
      >
        <Feather name={close ? 'x' : 'chevron-left'} size={22} color={Colors.ink} />
      </Pressable>
      <View className="flex-1">
        <Text className="text-xl font-bold text-ink" numberOfLines={1}>{title}</Text>
        {subtitle && <Text className="text-sm text-muted" numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  )
}
