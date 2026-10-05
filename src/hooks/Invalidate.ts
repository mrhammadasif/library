import type { QueryClient } from '@tanstack/react-query'

/** Library data that book state changes ripple into (shelf counts, loans, stats, history…). */
const LIBRARY_DATA_KEYS = ['books', 'book', 'racks', 'loans', 'audits', 'audit', 'stats', 'tags', 'events'] as const

export function invalidateLibraryData(client: QueryClient): Promise<void[]> {
  return Promise.all(LIBRARY_DATA_KEYS.map(key => client.invalidateQueries({ queryKey: [key] })))
}
