import { hasIn } from 'lodash-es'
import {
  onMounted,
  ref,
} from 'vue'

export function useShelves() {
  const notify = useNotification()
  const list = ref<{ id: number, name: string, color: string }[]>([])
  const loading = ref(false)

  const fetchShelves = async () => {
    loading.value = true
    try {
      list.value = await $fetch('/api/shelves')
    }
    catch (error: any) {
      notify.error({
        title: 'Failed to fetch shelves',
        content: hasIn(error, 'message') ? error.message : 'Undefined error',
      })
    }
    finally {
      loading.value = false
    }
  }

  const addShelf = async (name: string, color: string) => {
    try {
      loading.value = true
      await $fetch('/api/shelves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          color,
        }),
      })
    }
    catch (error) {
      console.error('Error adding shelf:', error)
    }
    finally {
      loading.value = false
      fetchShelves()
    }
  }

  onMounted(fetchShelves)

  return {
    list,
    loading,
    fetchShelves,
    addShelf,
  }
}
