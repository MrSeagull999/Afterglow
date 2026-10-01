import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

// Packaged: cwd is / (unwritable), so settings live in userData; dev keeps
// the project-root file it always used. Resolved lazily — `app` only exists
// inside Electron, and module-scope access breaks the node:test suite.
function getSettingsPath(): string {
  return app.isPackaged
    ? join(app.getPath('userData'), 'afterglow-settings.json')
    : join(app.getAppPath(), 'afterglow-settings.json')
}

export type PreviewModel = 'gemini-3.1-flash-image' | 'gemini-3-pro-image-preview'
export type FinalModel = 'gemini-3-pro-image-preview'
export type SeedStrategy = 'randomPerImage' | 'fixedPerRun'
export type LightingCondition = 'overcast' | 'sunny'
export type ImageProvider = 'google' | 'openrouter'
export type PromptStyle = 'full' | 'simplified'

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
  
  // Provider configuration (API keys in .env only)
  imageProvider: ImageProvider
  freeformImageModel?: string
  previewImageModel: string
  previewPriorityMode: boolean
  advancedCustomModel: string
  
  // Prompt style: 'full' uses detailed prompts with all guardrails, 'simplified' uses concise prompts
  promptStyle: PromptStyle

  // Auto-evaluation: score generated images and optionally retry low-quality results
  evaluationEnabled: boolean
  evaluationThreshold: number   // Min overall score (1-10) to accept without retry
  evaluationMaxRetries: number  // Max additional attempts if score is below threshold
  // 'auto_retry': retry automatically if below threshold (original behaviour)
  // 'flag_for_review': flag the version for user review instead of auto-retrying
  evaluationReviewMode: 'auto_retry' | 'flag_for_review'

  // Watch folder: auto-import new images from a configured directory
  watchFolderEnabled: boolean
  watchFolderPath: string | null
  watchFolderJobId: string | null

  // Mirror generated versions next to the imported original (e.g. the Lightroom
  // folder) as {name}-AG{NN}, so a Lightroom folder sync picks them up
  mirrorOutputsToSource: boolean

  // Privacy settings
  privacy: {
    safeFilenamesOnImport: boolean
  }
}

const DEFAULT_SETTINGS: Settings = {
  keepExif: false,
  outputFormat: 'png',
  previewWidth: 1536,
  finalWidth: 4000,
  concurrentPreviews: 3,
  autoApproveAll: false,
  theme: 'dark',
  previewModel: 'gemini-3.1-flash-image',
  finalModel: 'gemini-3-pro-image-preview',
  useSeed: true,
  reusePreviewSeedForFinal: true,
  seedStrategy: 'randomPerImage',
  fixedRunSeed: null,
  defaultLightingCondition: 'overcast',
  
  // Provider configuration (API keys in .env only)
  imageProvider: 'google',
  freeformImageModel: '',
  previewImageModel: 'gemini-3-pro-image-preview',
  previewPriorityMode: true,
  advancedCustomModel: '',
  
  // Prompt style
  promptStyle: 'full' as PromptStyle,

  // Auto-evaluation
  evaluationEnabled: false,
  evaluationThreshold: 7,
  evaluationMaxRetries: 1,
  evaluationReviewMode: 'flag_for_review' as const,

  // Watch folder
  watchFolderEnabled: false,
  watchFolderPath: null,
  watchFolderJobId: null,

  // Mirror outputs back to the source folder
  mirrorOutputsToSource: true,

  // Privacy settings
  privacy: {
    safeFilenamesOnImport: true
  }
}

let cachedSettings: Settings | null = null

export async function getSettings(): Promise<Settings> {
  if (cachedSettings) return cachedSettings
  
  if (!existsSync(getSettingsPath())) {
    cachedSettings = { ...DEFAULT_SETTINGS }
    await saveSettings(cachedSettings)
    return cachedSettings
  }

  try {
    const data = await readFile(getSettingsPath(), 'utf-8')
    cachedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(data) }
    // gemini-2.5-flash-image was shut down on 2026-10-02.
    for (const key of ['previewModel', 'previewImageModel', 'advancedCustomModel'] as const) {
      if (cachedSettings![key] === 'gemini-2.5-flash-image') (cachedSettings as any)[key] = 'gemini-3.1-flash-image'
    }
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
  await writeFile(getSettingsPath(), JSON.stringify(settings, null, 2))
}

export function clearSettingsCache(): void {
  cachedSettings = null
}
