import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const PRESETS_PATH = './prompt-bank/presets.json'

export interface PresetSettings {
  previewWidth: number
  finalImageSize: string
  outputFormatDefault: string
}

export interface Preset {
  id: string
  label: string
  description: string
  promptTemplate: string
  settings: PresetSettings
}

export interface PresetsFile {
  presets: Preset[]
  defaultPresetId: string
  version: string
}

let cachedPresets: PresetsFile | null = null

export async function loadPresets(): Promise<PresetsFile> {
  if (cachedPresets) return cachedPresets
  
  if (!existsSync(PRESETS_PATH)) {
    throw new Error(`Presets file not found: ${PRESETS_PATH}`)
  }
  
  const data = await readFile(PRESETS_PATH, 'utf-8')
  cachedPresets = JSON.parse(data)
  return cachedPresets!
}

export async function getPresets(): Promise<Preset[]> {
  const file = await loadPresets()
  return file.presets
}

export async function getPreset(presetId: string): Promise<Preset | null> {
  const file = await loadPresets()
  return file.presets.find(p => p.id === presetId) || null
}

export async function getDefaultPresetId(): Promise<string> {
  const file = await loadPresets()
  return file.defaultPresetId
}

export function clearPresetsCache(): void {
  cachedPresets = null
}
