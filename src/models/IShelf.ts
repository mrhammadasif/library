export interface IShelf {
  id: string
  rackId: string
  name: string
  notes: string | null
  position: number
  /** Books whose home is this shelf (on the shelf, lent out or missing). */
  bookCount: number
}

export interface IRack {
  id: string
  name: string
  notes: string | null
  position: number
  shelves: IShelf[]
}
