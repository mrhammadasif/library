import { describe, expect, it } from 'vitest'
import { emptyDraft } from '../shared/metadata'
import { setPendingDraft, takePendingDraft } from '~/utils/DraftStore'

describe('draftStore', () => {
  it('hands a draft over exactly once', () => {
    const draft = { ...emptyDraft(), title: 'Dune' }
    setPendingDraft(draft, 'file://cover.jpg')
    expect(takePendingDraft()).toEqual({ draft, photoUri: 'file://cover.jpg' })
    expect(takePendingDraft()).toBeNull()
  })
})
