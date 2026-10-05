import AsyncStorage from '@react-native-async-storage/async-storage'

export async function readJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key)
  return raw === null ? null : JSON.parse(raw) as T
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value))
}
