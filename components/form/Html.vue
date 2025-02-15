<script setup lang="ts">
import StarterKit from '@tiptap/starter-kit'
import {
  Editor,
  EditorContent,
} from '@tiptap/vue-3'

const props = withDefaults(defineProps<{
  label?: string
  name?: string
  type?: 'text' | 'password' | 'email' | 'textarea'
  readonly?: boolean
  feedback?: string
  copy?: boolean
  disabled?: boolean
  modelValue?: string | null
  clearable?: boolean | undefined
  labelOnLeft?: boolean
  hideFeedback?: boolean
  autocomplete?: string
  placeholder?: string
}>(), {
  type: 'text',
  feedback: '',
  labelOnLeft: true,
  autocomplete: 'off',
  hideFeedback: false,
  readonly: false,
  disabled: false,
  placeholder: '',
})

const emit = defineEmits(['update:modelValue'])
const editor = ref<Editor>()

watchImmediate(() => props.modelValue, (value) => {
  const isSame = editor.value?.getHTML() === value

  if (isSame) {
    return
  }

  if (editor.value) {
    editor.value?.commands.setContent(value ?? '', false, { preserveWhitespace: true })
  }
})

onMounted(() => {
  editor.value = new Editor({
    extensions: [StarterKit],
    editorProps: { attributes: { class: 'editor' } },
    content: props.modelValue,
    onPaste() {
      editor.value?.chain().focus().clearNodes().run()
    },
    onUpdate({ editor }) {
      emit('update:modelValue', editor.getHTML())
    },
  })
})

onUnmounted(() => {
  editor.value?.destroy()
})
</script>

<template>
  <NFormItem
    class="block w-full"
    :show-feedback="!props.hideFeedback"
    :label="props.label"
    :show-label="!!props.label"
    :label-placement="props.labelOnLeft ? 'left' : 'top'"
    :label-style="{ fontWeight: 'bold' }"
    :label-props="{
      'data-testid': `label-${props.name ?? 'unknown'}`,
    }"
    :path="props.name">
    <div class="w-full block">
      <div
        v-if="editor"
        class="container tiptap">
        <div class="control-group">
          <div class="button-group">
            <button
              :disabled="!editor.can().chain().focus().toggleBold().run()"
              :class="{ 'is-active': editor.isActive('bold') }"
              @click="editor.chain().focus().toggleBold().run()">
              <i-carbon-text-bold />
            </button>
            <button
              :disabled="!editor.can().chain().focus().toggleItalic().run()"
              :class="{ 'is-active': editor.isActive('italic') }"
              @click="editor.chain().focus().toggleItalic().run()">
              <i-carbon-text-italic />
            </button>
            <button
              :disabled="!editor.can().chain().focus().toggleStrike().run()"
              :class="{ 'is-active': editor.isActive('strike') }"
              @click="editor.chain().focus().toggleStrike().run()">
              <i-carbon-text-strikethrough />
            </button>
            <span class="separator"></span>
            <button
              :class="{ 'is-active': editor.isActive('bulletList') }"
              @click="editor.chain().focus().toggleBulletList().run()">
              <i-carbon-list />
            </button>
            <button
              :class="{ 'is-active': editor.isActive('orderedList') }"
              @click="editor.chain().focus().toggleOrderedList().run()">
              <i-carbon-list-numbered />
            </button>
            <button
              :class="{ 'is-active': editor.isActive('blockquote') }"
              @click="editor.chain().focus().toggleBlockquote().run()">
              <i-carbon-quotes />
            </button>
            <span class="separator"></span>
            <button
              :disabled="!editor.can().chain().focus().undo().run()"
              @click="editor.chain().focus().undo().run()">
              <i-carbon-undo />
            </button>
            <button
              :disabled="!editor.can().chain().focus().redo().run()"
              @click="editor.chain().focus().redo().run()">
              <i-carbon-redo />
            </button>
            <span class="separator"></span>
            <button @click="editor.chain().focus().unsetAllMarks().run()">
              Clear marks
            </button>
            <button @click="editor.chain().focus().clearNodes().run()">
              Clear nodes
            </button>
          </div>
        </div>
        <EditorContent
          :editor="editor"
          @paste="editor.chain().focus().clearNodes().run()" />
      </div>
    </div>
    <template
      v-if="props.feedback"
      #feedback>
      <div class="grid-area-[feedback] mb-3 block w-full space-y-2">
        <slot name="feedback">
          {{ props.feedback }}
        </slot>
      </div>
    </template>
  </NFormItem>
</template>
