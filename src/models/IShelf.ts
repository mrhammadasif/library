import type { IRackDto } from '~shared/contracts/Shelves'

export type IRack = IRackDto
export type IShelf = IRackDto['shelves'][number]
