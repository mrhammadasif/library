import type { IAiProviderConfigDto } from '~shared/contracts/Ai'
import type { IInviteDto, IMemberDto, IMembershipDto } from '~shared/contracts/Libraries'

export type AiProvider = IAiProviderConfigDto['provider']
export type IMembership = IMembershipDto
export type ILibrary = IMembershipDto['library']
export type IMember = IMemberDto
export type IInvite = IInviteDto
export type IAiProviderConfig = IAiProviderConfigDto

export interface IMe {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  /** Server admin: may mark libraries trusted (no daily allowances). */
  isAdmin: boolean
  /** Free AI suggestions per library per day for libraries without their own key; null = the server offers none. */
  freeAiPerDay: number | null
}
