<script lang="ts" setup generic="T, U">
import { cloneDeep } from 'lodash-es'

const props = withDefaults(defineProps<{
  label?: string
  name?: string
  feedback?: string
  itemLabel: string
  itemValue: string
  disabled?: boolean
  modelValue?: U
  labelOnLeft?: boolean
  // multiple?: boolean
  autocomplete?: string
  hideFeedback?: boolean
  // required and LOgical PROPS
  options: T[]
  loading: boolean
  filter?: string
  pageSize?: number
  pageIndex?: number
  total?: number
  enableLoadOnScrollTop?: boolean
}>(), {
  options: () => [],
  pageIndex: 1,
  pageSize: 10,
  total: 1,
  // multiple: false,
  feedback: '',
  filter: '',
  hideFeedback: false,
  enableLoadOnScrollTop: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: U]
  'update:filter': [filter: string]
  'nextPage': [pageIndex: number]
  'search': [q: string]
}>()

const localOptions = ref<T[]>([]) as Ref<T[]>
const requestedPages = ref<number[]>([])
const nextPageIndex = ref(0)

onMounted(() => {
  nextPageIndex.value = props.pageIndex === 0 ? 2 : props.pageIndex
})

watchImmediate(() => props.options, () => {
  localOptions.value = props.options
})

const pageCount = computed(() => {
  return Math.ceil(props.total / props.pageSize)
})

const tempOptions = ref<T[]>([]) as Ref<T[]>

defineExpose({
  add(items: any[]) {
    items.forEach((item) => {
      localOptions.value?.push(item)
    })
  },
  replace(items: any[]) {
    tempOptions.value = cloneDeep(localOptions.value)
    localOptions.value = items
  },
})

function restoreOptions() {
  localOptions.value = cloneDeep(tempOptions.value)
}

// const attrs = useAttrs()
const localFilter = ref('')

debouncedWatch(localFilter, () => {
  if (localFilter.value === '') {
    restoreOptions()
    return
  }

  emit('search', localFilter.value)
}, { debounce: 500 })

function clearSearch() {
  localFilter.value = ''
  restoreOptions()
}

const dropdownShown = ref(false)

watchEffect(() => {
  document.body.classList.toggle('overflow-hidden', dropdownShown.value)
})

const isPageRequested = computed<boolean>(() => requestedPages.value.includes(nextPageIndex.value))
const isAvailableNextPage = computed<boolean>(() => props.pageIndex < pageCount.value)

function handleScroll(e) {
  if (props.enableLoadOnScrollTop !== true) {
    return
  }

  const el = e.target as HTMLElement
  const isOnScrollTop = (el.scrollTop + el.clientHeight >= el.scrollHeight)

  if (isOnScrollTop && isAvailableNextPage.value && isPageRequested.value === false) {
    emit('nextPage', nextPageIndex.value)
    requestedPages.value.push(nextPageIndex.value)
    nextPageIndex.value += 1
  }
}
</script>

<template>
  <div class="w-full">
    <Loading
      :show="props.loading"
      class="w-full">
      <NFormItem
        class="w-full"
        :label-placement="props.labelOnLeft ? 'left' : 'top'"
        :show-feedback="!props.hideFeedback"
        :label="props.label"

        :show-label="!!props.label"
        :label-style="{ fontWeight: 'bold' }"
        :path="props.name">
        <NPopover
          v-model:show="dropdownShown"
          header-class="pa-0!"
          footer-class="pa-0!"
          content-class="pa-0!"
          placement="bottom"
          trigger="click">
          <template
            v-for="(_, slotName) in ($slots ?? [])"
            #[String(slotName)]="slotData"
            :key="slotName">
            <slot
              :name="slotName"
              v-bind="slotData || {}" />
          </template>
          <template #header>
            <slot name="header">
              <div class="bg-gray-100 p-4 dark:bg-gray-700">
                <div class="relative">
                  <input
                    v-model="localFilter"
                    class="w-full rounded-md bg-gray-200 px-2 py-2 shadow-md shadow-inset dark:bg-gray-500 placeholder-text-gray-400 focus:shadow-sm focus:outline-none focus:ring-1 focus:ring-gray-100"
                    placeholder="Enter Keyword to search...">
                  <TransitionFade>
                    <div
                      v-if="localFilter !== ''"
                      class="absolute right-3 hfull flex-center-inline"
                      @click="clearSearch">
                      <i-carbon-close-outline class="text-accent dark:text-white hover:opacity-70" />
                    </div>
                  </TransitionFade>
                </div>
              </div>
            </slot>
          </template>
          <template #trigger>
            <slot name="trigger">
              <div
                class="group h-10 pointer rounded bg-white px-2 text-text hover:text-opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75">
                <div class="h-10 w-full flex items-center justify-between">
                  <slot
                    name="option"
                    :item="props.modelValue">
                    <span class="single-line">{{ props.modelValue }}</span>
                  </slot>
                  <i-heroicons-chevron-down ml-2 />
                </div>
              </div>
            </slot>
          </template>
          <template #footer>
            <slot name="footer">
              <Loading :show="props.loading">
                <div class="flex text-nowrap items-center justify-between bg-gray-100 dark:bg-gray-800 pa-2">
                  <span class="text-3">Showing {{ localOptions.length }} of {{ props.total }} items</span>
                  <Btn
                    v-if="props.pageIndex < pageCount"
                    class="font-bold text-3"
                    :disabled="props.pageIndex >= pageCount"
                    @click="() => emit('nextPage', props.pageIndex + 1)">
                    Load More
                  </Btn>
                </div>
              </Loading>
            </slot>
          </template>
        </npopover>
      </nformitem>

      </slot>
      </apploading>
    </loading>
  </div>
</template>

          <!-- Body of the List -->
          <div class="block max-w-300 min-w-64 w-full overflow-hidden rounded-lg">
            <Loading :show="props.loading">
              <div
                class="max-h-480px w-full">
                <div
                  class="relative grid max-h-300px w-full gap-1 overflow-auto bg-white p-2 dark:bg-gray-600"
                  @scroll="handleScroll">
                  <div
                    v-for="item in localOptions"
                    :key="JSON.stringify(item)"
                    class="group flex pointer items-center justify-between rounded-lg text-dark transition duration-150 ease-in-out hover:bg-gray-200 dark:text-light dark:hover:bg-gray-500 dark:hover:text-light"
                    @click="emit('update:modelValue', item[props.itemValue])">
                    <div
                      class="single-line w-full"
                      :class="isEqual(item, props.modelValue) ? 'children:(color-success! bg-gray-100 dark:bg-gray-800)' : 'color-inherit!'">
                      <slot
                        name="option"
                        :item="item">
                        {{ item[props.itemLabel] }}
                      </slot>
                    </div>
                  </div>
                </div>
              </div>
              </Loading>

          </div>
        </NPopover>
      </NFormItem>
      </Loading>

  </div>
</template>
