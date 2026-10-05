export interface ILoan {
  id: string
  bookId: string
  bookTitle: string
  borrowerUserId: string | null
  borrowerName: string
  borrowerContact: string | null
  notes: string | null
  lentAt: string
  dueAt: string | null
  returnedAt: string | null
}
