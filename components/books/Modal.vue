<script lang="ts" setup>
import type { Book } from '@prisma/client'

const props = defineProps<{
  showModal: boolean
}>()

defineEmits(['close'])
const { fetchISBN, loading } = useBooks()
const notify = useNotification()

const newBook = ref<Partial<Book>>({
  title: '',
  author: '',
  isbn: '',
})

const isCustom = ref(false)

function onSubmit() {
  notify.success({
    title: 'Book added',
    content: 'Book has been added successfully',
  })
}

function onIsbnChange() {
  loading.value = true
  fetchISBN(newBook.value.isbn ?? '').then((book) => {
    if (book) {
      newBook.value = {
        title: book.title,
        author: book.author,
        thumbnail: book.thumbnail,
      }

      isCustom.value = false
    }
    else {
      isCustom.value = true
    }
  }).catch(() => {
    isCustom.value = true
  }).finally(() => {
    loading.value = false
  })
}

const rules = withRuleTriggers<Book>({
  isbn: {
    required: true,
    message: 'ISBN is required',
    min: 10,
    max: 13,
    pattern: /^\d+$/,
  },
  title: {
    required: true,
    message: 'Title is required',
  },
  author: {
    required: true,
    message: 'Author is required',
  },
})
</script>

<template>
  <div>
    <NDrawer
      placement="bottom"
      :show="props.showModal"
      default-height="50vh"
      @mask-click="$emit('close')">
      <NDrawerContent>
        <template #header>
          <div class="flex justify-end items-center space-x-2 px-4">
            <h4>Add Book</h4>
            <div class="flex-grow" />
            <NButton
              bordered
              ghost
              type="error"
              @click="$emit('close')">
              Close
            </NButton>
            <NButton
              type="primary"
              @click="onSubmit">
              Add
            </NButton>
          </div>
        </template>
        <Loading :show="loading">
          <NCard>
            <div>
              <FormWrapper
                :model="newBook"
                :rules="rules">
                <NFormItem
                  label="ISBN"
                  path="isbn">
                  <NInput
                    v-model:value="newBook.isbn"
                    placeholder=""
                    @keyup.enter="onIsbnChange" />
                </NFormItem>

                <template v-if="isCustom">
                  <NFormItem
                    label="Title"
                    path="title">
                    <NInput
                      v-model:value="newBook.title"
                      placeholder="" />
                  </NFormItem>
                  <NFormItem
                    label="Author"
                    path="author">
                    <NInput
                      v-model:value="newBook.author"
                      placeholder="" />
                  </NFormItem>
                  <NFormItem
                    label="Thumbnail"
                    path="thumbnail">
                    <NInput
                      v-model:value="newBook.thumbnail"
                      placeholder="Image URL" />
                  </NFormItem>
                  <!-- Preview -->
                  <img
                    v-if="!newBook.thumbnail"
                    :src="newBook.thumbnail" />
                </template>
              </FormWrapper>
            </div>
          </NCard>
        </Loading>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>
