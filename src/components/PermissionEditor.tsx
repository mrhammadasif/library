import type { Permission } from '~/constants/Permissions'
import { Feather } from '@expo/vector-icons'
import { Pressable, Switch, Text, View } from 'react-native'
import { Card } from '~/components/Card'
import { Chip } from '~/components/Chip'
import { Colors } from '~/constants/Colors'
import { PERMISSIONS, PRESETS } from '~/constants/Permissions'

interface IPermissionEditorProps {
  value: Permission[]
  onChange: (permissions: Permission[]) => void
  /** Permissions the editor may grant (the caller's own); others are shown locked. */
  grantable: Permission[]
}

/** Preset buttons plus one toggle per permission. */
export function PermissionEditor({ value, onChange, grantable }: IPermissionEditorProps) {
  const sorted = [...value].sort().join(',')
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap gap-2">
        {PRESETS.filter(p => p.permissions.every(x => grantable.includes(x))).map(p => (
          <Chip key={p.name} label={p.name} selected={[...p.permissions].sort().join(',') === sorted} onPress={() => onChange(p.permissions)} />
        ))}
      </View>
      <Card>
        {PERMISSIONS.map((p, i) => {
          const locked = !grantable.includes(p.key)
          const on = value.includes(p.key)
          return (
            <Pressable
              key={p.key}
              disabled={locked}
              onPress={() => onChange(on ? value.filter(x => x !== p.key) : [...value, p.key])}
              className={`flex-row items-center gap-3 py-3 ${i < PERMISSIONS.length - 1 ? 'border-b border-line' : ''} ${locked ? 'opacity-40' : ''}`}
            >
              <Feather name={p.icon} size={18} color={Colors.primary} />
              <View className="flex-1">
                <Text className="text-base font-medium text-ink">{p.label}</Text>
                <Text className="text-xs text-muted">{locked ? 'You can\'t grant this' : p.description}</Text>
              </View>
              <Switch
                value={on}
                disabled={locked}
                onValueChange={next => onChange(next ? [...value, p.key] : value.filter(x => x !== p.key))}
                trackColor={{ true: Colors.primary }}
              />
            </Pressable>
          )
        })}
      </Card>
    </View>
  )
}
