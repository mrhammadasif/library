import type { AiProvider, IAiProviderConfig } from '~/models/ILibrary'
import { useState } from 'react'
import { Switch, Text, View } from 'react-native'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { Chip } from '~/components/Chip'
import { ErrorState, Loading } from '~/components/EmptyState'
import { Field } from '~/components/Field'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { SectionHeader } from '~/components/SectionHeader'
import { Colors } from '~/constants/Colors'
import { useAiProviders, useDeleteAiProvider, useSetAiProvider, useSetAiUsage } from '~/hooks/Ai'
import { useCurrentLibrary } from '~/library/LibraryProvider'
import { errorMessage } from '~/utils/Errors'

const PROVIDERS: { key: AiProvider, name: string, defaultModel: string, blurb: string }[] = [
  { key: 'openai', name: 'OpenAI', defaultModel: 'gpt-5-mini', blurb: 'Reads covers and suggests tags. Needs an API key from platform.openai.com.' },
  { key: 'gemini', name: 'Google Gemini', defaultModel: 'gemini-2.5-flash', blurb: 'Reads covers and suggests tags. Needs an API key from aistudio.google.com.' },
  { key: 'openai_compatible', name: 'Self-hosted / Ollama', defaultModel: '', blurb: 'Any OpenAI-compatible endpoint over HTTPS, e.g. Ollama behind an authenticated gateway such as OmniRoute.' },
]

function ProviderForm({ libraryId, provider, existing }: { libraryId: string, provider: typeof PROVIDERS[number], existing?: IAiProviderConfig }) {
  const save = useSetAiProvider()
  const remove = useDeleteAiProvider()
  const [editing, setEditing] = useState(false)
  const [model, setModel] = useState(existing?.model ?? provider.defaultModel)
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? '')
  const [apiKey, setApiKey] = useState('')
  const [vision, setVision] = useState(existing?.supportsVision ?? false)
  const compatible = provider.key === 'openai_compatible'

  if (!editing) {
    return (
      <Card className="gap-2 py-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-bold text-ink">{provider.name}</Text>
          <Text className={`text-sm font-semibold ${existing ? 'text-positive' : 'text-faint'}`}>{existing ? 'Set up' : 'Not set up'}</Text>
        </View>
        <Text className="text-sm text-muted">{existing ? `Model ${existing.model}${existing.baseUrl ? ` · ${existing.baseUrl}` : ''}` : provider.blurb}</Text>
        <Button small variant="secondary" label={existing ? 'Change' : 'Set up'} onPress={() => setEditing(true)} />
      </Card>
    )
  }

  return (
    <Card className="gap-3 py-4">
      <Text className="text-base font-bold text-ink">{provider.name}</Text>
      {compatible && (
        <Field label="Base URL" value={baseUrl} onChangeText={setBaseUrl} autoCapitalize="none" keyboardType="url" placeholder="https://gateway.example.com/v1" hint="Must be HTTPS and end with /v1" />
      )}
      <Field label="Model" value={model} onChangeText={setModel} autoCapitalize="none" placeholder={compatible ? 'e.g. ollama-local/qwen…' : provider.defaultModel} />
      <Field
        label="API key"
        value={apiKey}
        onChangeText={setApiKey}
        secureTextEntry
        autoCapitalize="none"
        placeholder={existing?.hasKey ? 'Saved (leave blank to keep)' : ''}
        hint="Stored encrypted on the server; the app never shows it again."
      />
      {compatible && (
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 text-sm text-ink">The model can read images (cover recognition)</Text>
          <Switch value={vision} onValueChange={setVision} trackColor={{ true: Colors.primary }} />
        </View>
      )}
      {(save.error || remove.error) && <Text className="text-sm text-negative">{errorMessage(save.error ?? remove.error)}</Text>}
      <View className="flex-row gap-2">
        <View className="flex-1"><Button small variant="secondary" label="Cancel" onPress={() => setEditing(false)} /></View>
        {existing && (
          <View className="flex-1">
            <Button small variant="danger" label="Remove" loading={remove.isPending} onPress={() => remove.mutate({ libraryId, provider: provider.key }, { onSuccess: () => setEditing(false) })} />
          </View>
        )}
        <View className="flex-1">
          <Button
            small
            label="Save"
            loading={save.isPending}
            disabled={!model.trim() || (!existing?.hasKey && !apiKey.trim()) || (compatible && !baseUrl.startsWith('https://'))}
            onPress={() => save.mutate(
              { libraryId, provider: provider.key, model, baseUrl: compatible ? baseUrl : null, apiKey, supportsVision: vision },
              { onSuccess: () => {
                setApiKey('')
                setEditing(false)
              } },
            )}
          />
        </View>
      </View>
    </Card>
  )
}

/** Per-library AI: keys (stored in Vault), which provider suggests metadata, which reads cover photos. */
export default function AiSettingsScreen() {
  const { library } = useCurrentLibrary()
  const providers = useAiProviders(library.id)
  const usage = useSetAiUsage()
  const configured = providers.data ?? []
  const visionCapable = configured.filter(p => p.supportsVision)
  const nameOf = (key: AiProvider) => PROVIDERS.find(p => p.key === key)!.name

  function setUsage(enrich: AiProvider | null, vision: AiProvider | null) {
    usage.mutate({ libraryId: library.id, enrich, vision })
  }

  return (
    <Screen header={<Header title="AI & cover recognition" subtitle={library.name} />}>
      {providers.isPending && <Loading />}
      {providers.error && <ErrorState error={providers.error} onRetry={providers.refetch} />}
      {providers.data && (
        <>
          <View className="gap-3">
            <SectionHeader title="Use AI for" />
            <Card className="gap-3 py-4">
              <Text className="text-sm font-semibold text-muted">Suggesting tags, categories and descriptions</Text>
              <View className="flex-row flex-wrap gap-2">
                <Chip label="Off" selected={!library.enrichProvider} onPress={() => setUsage(null, library.visionProvider)} />
                {configured.map(p => (
                  <Chip key={p.provider} label={nameOf(p.provider)} selected={library.enrichProvider === p.provider} onPress={() => setUsage(p.provider, library.visionProvider)} />
                ))}
              </View>
              <Text className="text-sm font-semibold text-muted">Recognising books from cover photos</Text>
              <View className="flex-row flex-wrap gap-2">
                <Chip label="Off" selected={!library.visionProvider} onPress={() => setUsage(library.enrichProvider, null)} />
                {visionCapable.map(p => (
                  <Chip key={p.provider} label={nameOf(p.provider)} selected={library.visionProvider === p.provider} onPress={() => setUsage(library.enrichProvider, p.provider)} />
                ))}
              </View>
              {configured.length === 0 && <Text className="text-sm text-faint">Set up a provider below first.</Text>}
              {usage.error && <Text className="text-sm text-negative">{errorMessage(usage.error)}</Text>}
            </Card>
          </View>
          <View className="gap-3">
            <SectionHeader title="Providers" />
            {PROVIDERS.map(p => (
              <ProviderForm key={p.key} libraryId={library.id} provider={p} existing={configured.find(c => c.provider === p.key)} />
            ))}
          </View>
        </>
      )}
    </Screen>
  )
}
