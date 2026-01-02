import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'

const SETTINGS_PATH = './afterglow-settings.json'

export type PreviewModel = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview'
export type FinalModel = 'gemini-3-pro-image-preview'
export type SeedStrategy = 'randomPerImage' | 'fixedPerRun'
export type LightingCondition = 'overcast' | 'sunny'

export interface Settings {
  keepExif: boolean
  outputFormat: 'png' | 'jpeg'
  previewWidth: number
  finalWidth: number
  concurrentPreviews: number
  autoApproveAll: boolean
  theme: 'dark' | 'light'
  previewModel: PreviewModel
  finalModel: FinalModel
  useSeed: boolean
  reusePreviewSeedForFinal: boolean
  seedStrategy: SeedStrategy
  fixedRunSeed: number | null
  defaultLightingCondition: LightingCondition
}

const DEFAULT_SETTINGS: Settings = {
  keepExif: false,
  outputFormat: 'png',
  previewWidth: 1536,
  finalWidth: 4000,
  concurrentPreviews: 3,
  autoApproveAll: false,
  theme: 'dark',
  previewModel: 'gemini-2.5-flash-image',
  finalModel: 'gemini-3-pro-image-preview',
  useSeed: true,
  reusePreviewSeedForFinal: true,
  seedStrategy: 'randomPerImage',
  fixedRunSeed: null,
  defaultLightingCondition: 'overcast'
}

let cachedSettings: Settings | null = null

export async function getSettings(): Promise<Settings> {
  if (cachedSettings) return cachedSettings
  
  if (!existsSync(SETTINGS_PATH)) {
    cachedSettings = { ...DEFAULT_SETTINGS }
    await saveSettings(cachedSettings)
    return cachedSettings
  }
  
  try {
    const data = await readFile(SETTINGS_PATH, 'utf-8')
    cachedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(data) }
    return cachedSettings!
  } catch {
    cachedSettings = { ...DEFAULT_SETTINGS }
    return cachedSettings
  }
}

export async function updateSettings(updates: Partial<Settings>): Promise<Settings> {
  const current = await getSettings()
  cachedSettings = { ...current, ...updates }
  await saveSettings(cachedSettings)
  return cachedSettings
}

async function saveSettings(settings: Settings): Promise<void> {
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2))
}

export function clearSettingsCache(): void {
  cachedSettings = null
}
