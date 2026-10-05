import type { IRack } from '~/models/IShelf'
import { Text, View } from 'react-native'
import { Chip } from '~/components/Chip'

interface IShelfPickerProps {
  racks: IRack[]
  value: string | null
  onChange: (shelfId: string) => void
  /** Hides a shelf (e.g. the one books are moving from). */
  exclude?: string | null
}

/** Shelves grouped by rack as selectable chips. */
export function ShelfPicker({ racks, value, onChange, exclude }: IShelfPickerProps) {
  const visible = racks.filter(r => r.shelves.some(s => s.id !== exclude))
  if (visible.length === 0) {
    return <Text className="text-sm text-muted">No shelves yet. Add racks and shelves in the Shelves tab first.</Text>
  }
  return (
    <View className="gap-3">
      {visible.map(rack => (
        <View key={rack.id} className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wider text-faint">{rack.name}</Text>
          <View className="flex-row flex-wrap gap-2">
            {rack.shelves.filter(s => s.id !== exclude).map(shelf => (
              <Chip key={shelf.id} label={shelf.name} selected={shelf.id === value} onPress={() => onChange(shelf.id)} />
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}
