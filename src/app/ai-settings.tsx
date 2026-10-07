import type { AiProvider, IAiProviderConfig } from '~/models/ILibrary'
import { useState } from 'react'
import { Linking, Switch, Text, View } from 'react-native'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { Chip } from '~/components/Chip'
import { Collapsible } from '~/components/Collapsible'
import { ErrorState, Loading } from '~/components/EmptyState'
import { Field } from '~/components/Field'
import { Header } from '~/components/Header'
import { Screen } from '~/components/Screen'
import { SectionHeader } from '~/components/SectionHeader'
import { Colors } from '~/constants/Colors'
import { useAiProviders, useDeleteAiProvider, useSetAiProvider, useSetAiUsage } from '~/hooks/Ai'
import { useMe, useSetHomeAi } from '~/hooks/Libraries'
import { useCan, useCurrentLibrary } from '~/library/LibraryProvider'
import { errorMessage } from '~/utils/Errors'

interface IProviderInfo {
  key: AiProvider
  name: string
  defaultModel: string
  blurb: string
  /** Where to create a key (shown as "Get a key"). */
  keyUrl?: string
}

// Gemini first: Google AI Studio keys are free, and flash-lite was the most accurate for the price in our comparison.
const PROVIDERS: IProviderInfo[] = [
  { key: 'gemini', name: 'Google Gemini', defaultModel: 'gemini-3.1-flash-lite', blurb: 'Free key from Google AI Studio. Fills in book details and reads covers.', keyUrl: 'https://aistudio.google.com/apikey' },
  { key: 'openai', name: 'OpenAI', defaultModel: 'gpt-5-mini', blurb: 'Paid key from OpenAI. Fills in book details and reads covers.', keyUrl: 'https://platform.openai.com/api-keys' },
]
const SELF_HOSTED: IProviderInfo = { key: 'openai_compatible', name: 'Self-hosted', defaultModel: '', blurb: 'Any OpenAI-compatible endpoint over HTTPS (e.g. your own gateway).' }
const ALL_PROVIDERS = [...PROVIDERS, SELF_HOSTED]

function ProviderForm({ libraryId, provider, existing, onSaved }: {
  libraryId: string
  provider: IProviderInfo
  existing?: IAiProviderConfig
  /** After a successful save (the server has already tested the key). */
  onSaved: (provider: AiProvider, supportsVision: boolean) => void
}) {
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
        <View className="flex-row gap-2">
          {!existing && provider.keyUrl && (
            <View className="flex-1"><Button small variant="ghost" icon="key" label="Get a key" onPress={() => Linking.openURL(provider.keyUrl!)} /></View>
          )}
          <View className="flex-1"><Button small variant="secondary" label={existing ? 'Change' : 'Add my key'} onPress={() => setEditing(true)} /></View>
        </View>
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
        placeholder={existing?.hasKey ? 'Saved (leave blank to keep)' : 'Paste your key'}
        hint="We test it, then store it encrypted. The app never shows it again."
      />
      {provider.keyUrl && !existing && (
        <Text className="text-sm text-primary" onPress={() => Linking.openURL(provider.keyUrl!)} accessibilityRole="link">
          🔑 Don't have one? Get a key
        </Text>
      )}
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
            label={save.isPending ? 'Checking the key…' : 'Save'}
            loading={save.isPending}
            disabled={!model.trim() || (!existing?.hasKey && !apiKey.trim()) || (compatible && !baseUrl.startsWith('https://'))}
            onPress={() => save.mutate(
              { libraryId, provider: provider.key, model, baseUrl: compatible ? baseUrl : null, apiKey, supportsVision: vision },
              { onSuccess: () => {
                setApiKey('')
                setEditing(false)
                onSaved(provider.key, compatible ? vision : true)
              } },
            )}
          />
        </View>
      </View>
    </Card>
  )
}

/**
 * Per-library AI: people bring their own key (encrypted on the server, tested on save); which provider fills in book
 * details and which reads cover photos. Home AI (the server's own key) only appears for libraries the admin allowed.
 */
export default function AiSettingsScreen() {
  const { library } = useCurrentLibrary()
  const providers = useAiProviders(library.id)
  const usage = useSetAiUsage()
  const me = useMe()
  const homeAi = useSetHomeAi()
  const canManage = useCan('ai.manage')
  const configured = providers.data ?? []
  const visionCapable = configured.filter(p => p.supportsVision)
  const nameOf = (key: AiProvider) => ALL_PROVIDERS.find(p => p.key === key)!.name

  function setUsage(enrich: AiProvider | null, vision: AiProvider | null) {
    usage.mutate({ libraryId: library.id, enrich, vision })
  }

  // A newly added key should just work: switch it on for whatever isn't using anything yet (Home AI stays if allowed).
  function startUsing(provider: AiProvider, supportsVision: boolean) {
    const enrich = library.enrichProvider ?? (library.homeAiAllowed ? null : provider)
    const vision = library.visionProvider ?? (supportsVision ? provider : null)
    if (enrich !== library.enrichProvider || vision !== library.visionProvider) {
      setUsage(enrich, vision)
    }
  }

  return (
    <Screen header={<Header title="Smart helpers (AI)" subtitle={library.name} />}>
      {providers.isPending && <Loading />}
      {providers.error && <ErrorState error={providers.error} onRetry={providers.refetch} />}
      {me.data?.isAdmin && (
        <Card className="flex-row items-center gap-3 py-4">
          <Text className="text-2xl">🏠</Text>
          <View className="flex-1">
            <Text className="text-lg font-bold text-ink">Home AI</Text>
            <Text className="text-sm text-muted">Server admin: let this library use the home server's AI for free tag ideas.</Text>
          </View>
          <Switch
            value={library.homeAiAllowed}
            onValueChange={allowed => homeAi.mutate({ libraryId: library.id, allowed })}
            trackColor={{ true: Colors.primary }}
          />
        </Card>
      )}
      {providers.data && canManage && configured.length === 0 && !library.homeAiAllowed && (
        <Card className="gap-2 py-4">
          <Text className="text-lg font-bold text-ink">✨ Let AI fill in the details</Text>
          <Text className="text-base text-muted">
            Add your own AI key and the app will suggest tags, categories and a description for each book, and recognise books from a cover photo. A Google Gemini key is free.
          </Text>
        </Card>
      )}
      {providers.data && canManage && (
        <>
          <View className="gap-3">
            <SectionHeader title="Use AI for" />
            <Card className="gap-3 py-4">
              <Text className="text-sm font-semibold text-muted">Suggesting tags, categories and descriptions</Text>
              <View className="flex-row flex-wrap gap-2">
                <Chip label={library.homeAiAllowed ? '🏠 Home AI (free)' : 'Off'} selected={!library.enrichProvider} onPress={() => setUsage(null, library.visionProvider)} />
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
              <ProviderForm key={p.key} libraryId={library.id} provider={p} existing={configured.find(c => c.provider === p.key)} onSaved={startUsing} />
            ))}
            <Collapsible title="Advanced" initiallyOpen={configured.some(c => c.provider === SELF_HOSTED.key)}>
              <ProviderForm libraryId={library.id} provider={SELF_HOSTED} existing={configured.find(c => c.provider === SELF_HOSTED.key)} onSaved={startUsing} />
            </Collapsible>
          </View>
        </>
      )}
    </Screen>
  )
}
