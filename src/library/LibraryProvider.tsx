import type { ReactNode } from 'react'
import type { Permission } from '~/constants/Permissions'
import type { IMembership } from '~/models/ILibrary'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, use, useEffect, useState } from 'react'
import { useAuth } from '~/auth/AuthProvider'
import { StorageKeys } from '~/constants/StorageKeys'
import { useMemberships } from '~/hooks/Libraries'

interface ILibraryContext {
  loading: boolean
  memberships: IMembership[]
  /** The selected library; null only while loading or when the user has none. */
  current: IMembership | null
  select: (libraryId: string) => void
}

const LibraryContext = createContext<ILibraryContext | null>(null)

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  // Unverified users can't do anything with libraries yet; wait until they've confirmed their email.
  const verifiedId = user?.emailVerified ? user.id : undefined
  const memberships = useMemberships(verifiedId)
  const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    AsyncStorage.getItem(StorageKeys.CurrentLibrary).then(setSelectedId).catch(() => setSelectedId(null))
  }, [])

  const list = memberships.data ?? []
  const current = list.find(m => m.library.id === selectedId) ?? list[0] ?? null

  function select(libraryId: string) {
    setSelectedId(libraryId)
    AsyncStorage.setItem(StorageKeys.CurrentLibrary, libraryId).catch(() => {})
  }

  const loading = !!verifiedId && (memberships.isPending || selectedId === undefined)
  return <LibraryContext value={{ loading, memberships: list, current, select }}>{children}</LibraryContext>
}

export function useLibrary(): ILibraryContext {
  const context = use(LibraryContext)
  if (!context) {
    throw new Error('useLibrary must be used inside LibraryProvider')
  }
  return context
}

/** The selected library. Only use in screens behind the "has a library" route guard. */
export function useCurrentLibrary(): IMembership {
  const { current } = useLibrary()
  if (!current) {
    throw new Error('No library selected')
  }
  return current
}

/** Whether the caller holds a permission in the selected library (owners hold all). */
export function useCan(permission: Permission): boolean {
  const { current } = useLibrary()
  return !!current?.permissions.includes(permission)
}
