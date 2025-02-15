<script lang="ts" setup>
const params = useRoute()
const { list } = useBooks(params.params.shelfId.toString() || null)
</script>

<template>
  <div>
    <h2>Books</h2>
    <ul>
      <li
        v-for="book in list"
        :key="book.id">
        {{ book.title }}
      </li>
    </ul>
  </div>
</template>

<style>

</style>
