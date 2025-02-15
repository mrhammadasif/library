<script lang="ts" setup>
import type { Book } from '@prisma/client'

defineProps<{
  book: Book
}>()
</script>

<template>
  <div>
    <p>{{ book.title }}</p>
    <p>Author: {{ book.author }}</p>
    <p>Published: {{ book.isbn }}</p>
  </div>
</template>
