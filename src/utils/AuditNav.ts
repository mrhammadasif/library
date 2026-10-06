import type { IAudit } from '~/models/IAudit'
import { router } from 'expo-router'

/** Unfinished quick checks open the one-book-at-a-time game; everything else opens the full audit view. */
export function openAudit(audit: Pick<IAudit, 'id' | 'mode' | 'completedAt'>) {
  if (audit.mode === 'random' && !audit.completedAt) {
    router.push({ pathname: '/audit/play/[id]', params: { id: audit.id } })
  }
  else {
    router.push({ pathname: '/audit/[id]', params: { id: audit.id } })
  }
}
