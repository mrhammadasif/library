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
  <div class="text-center max-w-400px mx-a">
    <Loading :show="loading">
      <div class="flex justify-between items-center">
        <h2>Shelves</h2>
        <NButton @click="onAddShelf">
          Add Shelf
        </NButton>
      </div>
      <div class="flex flex-col justify-center space-y-2">
        <div
          v-for="shelf in list"
          :key="shelf.id">
          <NButton
            block
            :color="shelf.color"
            @click="selectShelf(shelf)">
            {{ shelf.name }}
          </NButton>
        </div>
      </div>
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
