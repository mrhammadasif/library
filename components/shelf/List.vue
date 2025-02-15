<script setup lang="ts">
import type { Shelf } from '@prisma/client'
import { useRouter } from 'vue-router'

const { loading, list, addShelf } = useShelves()
const router = useRouter()
const dialog = useDialog()

function selectShelf(shelf: Shelf) {
  router.push(`/shelves/${shelf.id}`)
}

const newShelf = ref('')

function onAddShelf() {
  dialog.success({
    title: 'Add Shelf',
    positiveText: 'Add',
    content: () => h('input', {
      type: 'text',
      placeholder: 'Name',
      onChange: (e: Event) => {
        newShelf.value = (e.target as HTMLInputElement).value
      },
    }),
    onPositiveClick: () => {
      if (newShelf.value) {
        addShelf(newShelf.value, '#000000')
      }
    },
  })
}
</script>

<template>
  <div>
    <Loading :show="loading">
      <h2>Shelves</h2>
      <ul>
        <li
          v-for="shelf in list"
          :key="shelf.id"
          @click="selectShelf(shelf)">
          <span :style="{ color: shelf.color }">{{ shelf.name }}</span>
        </li>
      </ul>
      <button @click="onAddShelf">
        Add Shelf
      </button>
    </Loading>
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
</style>
