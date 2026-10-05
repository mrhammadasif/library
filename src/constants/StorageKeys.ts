export const StorageKeys = {
  CurrentLibrary: 'library.currentLibrary',
  /** Per library: the last shelf a book was added to, pre-selected on the next add. */
  LastShelf: (libraryId: string) => `library.lastShelf.${libraryId}`,
} as const
