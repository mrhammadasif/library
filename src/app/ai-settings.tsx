import type { AiProvider, IAiProviderConfig } from '~/models/ILibrary'
import { useState } from 'react'
import Slider from '@react-native-community/slider'
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
import { useAiLimit, useAiProviders, useDeleteAiProvider, useSetAiLimit, useSetAiProvider, useSetAiUsage } from '~/hooks/Ai'
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

// The slider covers everyday amounts; the number field goes up to the server's maximum.
const SLIDER_MAX = 500
const LIMIT_MAX = 10_000
const DEFAULT_LIMIT = 50

function clampLimit(n: number): number {
  return Math.min(LIMIT_MAX, Math.max(1, Math.round(n)))
}

/**
 * The library's own daily cap on AI requests: off = no limit; on = a slider for everyday amounts plus a number field for
 * exact (or larger) values. Saves when the slider is released or the field is left.
 */
function DailyLimitCard({ saved, usedToday, saving, error, onSave }: {
  saved: number | null
  usedToday: number
  saving: boolean
  error: unknown
  onSave: (dailyLimit: number | null) => void
}) {
  const [value, setValue] = useState(saved ?? DEFAULT_LIMIT)
  const [text, setText] = useState(String(saved ?? DEFAULT_LIMIT))
  const on = saved !== null

  function commit(n: number) {
    const next = clampLimit(n)
    setValue(next)
    setText(String(next))
    if (next !== saved) {
      onSave(next)
    }
  }

  return (
    <Card className="gap-4 py-4">
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="text-base font-bold text-ink">Limit AI requests per day</Text>
          <Text className="text-sm text-muted">AI uses your own key, so you decide. When the limit is reached, books still save; AI waits until tomorrow.</Text>
        </View>
        <Switch
          value={on}
          disabled={saving}
          onValueChange={next => onSave(next ? clampLimit(value) : null)}
          trackColor={{ true: Colors.primary }}
          accessibilityLabel="Limit AI requests per day"
        />
      </View>
      {on && (
        <View className="gap-2">
          <View className="flex-row items-center gap-3">
            <Slider
              style={{ flex: 1, height: 40 }}
              minimumValue={1}
              maximumValue={SLIDER_MAX}
              step={1}
              value={Math.min(value, SLIDER_MAX)}
              onValueChange={(n) => {
                setValue(n)
                setText(String(n))
              }}
              onSlidingComplete={commit}
              minimumTrackTintColor={Colors.primary}
              maximumTrackTintColor={Colors.line}
              thumbTintColor={Colors.primary}
              accessibilityLabel="AI requests per day"
            />
            <View className="w-24">
              <Field
                label=""
                value={text}
                onChangeText={t => setText(t.replace(/\D/g, ''))}
                onEndEditing={() => commit(Number(text) || 1)}
                keyboardType="number-pad"
                maxLength={5}
                testID="ai-daily-limit-input"
                accessibilityLabel="AI requests per day"
              />
            </View>
          </View>
          <Text className="text-sm text-muted">{`${value} a day · up to ${LIMIT_MAX.toLocaleString()} by typing`}</Text>
        </View>
      )}
      <Text className="text-sm font-semibold text-ink">{`Used today: ${usedToday}${on ? ` of ${saved}` : ''}`}</Text>
      {!!error && <Text className="text-sm text-negative">{errorMessage(error)}</Text>}
    </Card>
  )
}

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
 * details and which reads cover photos. The server has no AI key of its own.
 */
export default function AiSettingsScreen() {
  const { library } = useCurrentLibrary()
  const providers = useAiProviders(library.id)
  const usage = useSetAiUsage()
  const canManage = useCan('ai.manage')
  const limit = useAiLimit(library.id, canManage)
  const free = limit.data?.free ?? null
  const setLimit = useSetAiLimit()
  const configured = providers.data ?? []
  const visionCapable = configured.filter(p => p.supportsVision)
  const nameOf = (key: AiProvider) => ALL_PROVIDERS.find(p => p.key === key)!.name

  function setUsage(enrich: AiProvider | null, vision: AiProvider | null) {
    usage.mutate({ libraryId: library.id, enrich, vision })
  }

  // A newly added key should just work: switch it on for whatever isn't using anything yet.
  function startUsing(provider: AiProvider, supportsVision: boolean) {
    const enrich = library.enrichProvider ?? provider
    const vision = library.visionProvider ?? (supportsVision ? provider : null)
    if (enrich !== library.enrichProvider || vision !== library.visionProvider) {
      setUsage(enrich, vision)
    }
  }

  return (
    <Screen header={<Header title="Smart helpers (AI)" subtitle={library.name} />}>
      {providers.isPending && <Loading />}
      {providers.error && <ErrorState error={providers.error} onRetry={providers.refetch} />}
      {providers.data && canManage && configured.length === 0 && (
        <Card className="gap-2 py-4">
          <Text className="text-lg font-bold text-ink">✨ Let AI fill in the details</Text>
          <Text className="text-base text-muted">
            {free
              ? `You get ${free.perDay} free AI suggestions a day (tags, categories, a description). Add your own key for as many as you like, and to recognise books from a cover photo. A Google Gemini key is free.`
              : 'Add your own AI key and the app will suggest tags, categories and a description for each book, and recognise books from a cover photo. A Google Gemini key is free.'}
          </Text>
          {free && <Text className="text-sm font-semibold text-ink">{`Free suggestions used today: ${free.usedToday} of ${free.perDay}`}</Text>}
        </Card>
      )}
      {providers.data && canManage && (
        <>
          <View className="gap-3">
            <SectionHeader title="Use AI for" />
            <Card className="gap-3 py-4">
              <Text className="text-sm font-semibold text-muted">Suggesting tags, categories and descriptions</Text>
              <View className="flex-row flex-wrap gap-2">
                <Chip label={free ? `✨ Free (${free.perDay} a day)` : 'Off'} selected={!library.enrichProvider} onPress={() => setUsage(null, library.visionProvider)} />
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
          {configured.length > 0 && limit.data && (
            <View className="gap-3">
              <SectionHeader title="Daily limit" />
              <DailyLimitCard
                key={limit.data.dailyLimit ?? 'none'}
                saved={limit.data.dailyLimit}
                usedToday={limit.data.usedToday}
                saving={setLimit.isPending}
                error={setLimit.error}
                onSave={dailyLimit => setLimit.mutate({ libraryId: library.id, dailyLimit })}
              />
            </View>
          )}
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
