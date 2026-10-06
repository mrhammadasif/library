import type { IRack } from '~/models/IShelf'
import { Feather } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'
import { Colors } from '~/constants/Colors'

interface IShelfPickerProps {
  racks: IRack[]
  value: string | null
  onChange: (shelfId: string) => void
  /** Hides a shelf (e.g. the one books are moving from). */
  exclude?: string | null
  /** Marked "last time" to help batch-adding. */
  recent?: string | null
}

/** Bookcases with big tappable shelves, top to bottom like the real thing. */
export function ShelfPicker({ racks, value, onChange, exclude, recent }: IShelfPickerProps) {
  const visible = racks.filter(r => r.shelves.some(s => s.id !== exclude))
  if (visible.length === 0) {
    return <Text className="text-base text-muted">There are no shelves yet. Add a bookcase and its shelves in the Shelves tab first.</Text>
  }
  return (
    <View className="gap-4">
      {visible.map(rack => (
        <View key={rack.id} className="gap-2">
          <Text className="text-base font-bold text-muted">📚 {rack.name}</Text>
          {rack.shelves.filter(s => s.id !== exclude).map((shelf) => {
            const selected = shelf.id === value
            return (
              <Pressable
                key={shelf.id}
                onPress={() => onChange(shelf.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${rack.name}, ${shelf.name}`}
                className={`min-h-14 flex-row items-center gap-3 rounded-2xl border-2 px-4 py-3 ${selected ? 'border-primary bg-primary-soft' : 'border-line bg-card'}`}
              >
                <View className={`h-7 w-7 items-center justify-center rounded-full border-2 ${selected ? 'border-primary bg-primary' : 'border-faint'}`}>
                  {selected && <Feather name="check" size={16} color="#fff" />}
                </View>
                <Text className={`flex-1 text-lg ${selected ? 'font-bold text-primary' : 'text-ink'}`}>{shelf.name}</Text>
                {shelf.id === recent && !selected && <Text className="text-sm text-faint">last time</Text>}
                <Text className="text-sm text-muted">{shelf.bookCount} 📕</Text>
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}

/** Compact current-choice row with a "Change" affordance, so a remembered shelf doesn't need re-picking. */
export function ShelfChoice({ label, onChange }: { label: string, onChange: () => void }) {
  return (
    <Pressable onPress={onChange} accessibilityRole="button" accessibilityLabel={`Shelf: ${label}. Change`} className="min-h-14 flex-row items-center gap-3 rounded-2xl border-2 border-primary bg-primary-soft px-4 py-3">
      <Text className="text-2xl">📍</Text>
      <Text className="flex-1 text-lg font-bold text-primary">{label}</Text>
      <Text className="text-base font-semibold text-primary">Change</Text>
      <Feather name="chevron-down" size={20} color={Colors.primary} />
    </Pressable>
  )
}
