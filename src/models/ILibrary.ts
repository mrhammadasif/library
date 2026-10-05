import type { Permission } from '~/constants/Permissions'

export type AiProvider = 'openai' | 'gemini' | 'openai_compatible'

export interface ILibrary {
  id: string
  name: string
  enrichProvider: AiProvider | null
  visionProvider: AiProvider | null
}

export interface IMembership {
  library: ILibrary
  role: 'owner' | 'member'
  /** Effective permissions: every permission for owners. */
  permissions: Permission[]
}

export interface IMember {
  userId: string
  displayName: string
  role: 'owner' | 'member'
  permissions: Permission[]
  joinedAt: string
}

export interface IInvite {
  id: string
  code: string
  permissions: Permission[]
  expiresAt: string
  maxUses: number
  uses: number
}

export interface IAiProviderConfig {
  provider: AiProvider
  model: string
  baseUrl: string | null
  supportsVision: boolean
  hasKey: boolean
}
