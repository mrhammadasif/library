<script setup lang="tsx">
const router = useRoute()
const shelfId = computed<number>(() => Number.parseInt(router.params.shelfId?.toString() ?? undefined))
const { list, loading, fetchBooks } = useBooks(shelfId)
const lentBookId = ref<number | null>(null)
const showModal = ref(false)

function onAddBook() {
  showModal.value = true
}

function onLendBook(bookId: number) {
  lentBookId.value = bookId
  fetchBooks()
}
</script>

<template>
  <div class="max-w-500px mx-a py-4">
    <Loading :show="loading">
      <div class="flex justify-between">
        <h2>Books</h2>
        <NButton @click="onAddBook">
          Add Book
        </NButton>
      </div>
      <div>
        <div
          v-for="book in list"
          :key="book.id">
          <BooksItem :book />
        </div>
        <div
          v-if="list.length <= 0"
          class="flex flex-col items-center">
          <p>No books found</p>
          <NButton @click="onAddBook">
            Add Book
          </NButton>
        </div>
      </div>
    </Loading>
    <BooksModal
      :show-modal
      @close="showModal = false" />
  </div>
</template>

<style scoped>
ul {
  list-style-type: none;
  padding: 0;
}

li {
  cursor: pointer;
  margin: 5px 0;
}

button {
  margin-left: 10px;
}
</style>
