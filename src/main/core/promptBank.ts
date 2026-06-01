import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const PRESETS_PATH = './prompt-bank/presets.json'
const RELIGHT_PRESETS_PATH = './prompt-bank/relight-presets.json'

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
let cachedRelightPresets: PresetsFile | null = null

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

// ReLight presets
export async function loadRelightPresets(): Promise<PresetsFile> {
  if (cachedRelightPresets) return cachedRelightPresets
  
  if (!existsSync(RELIGHT_PRESETS_PATH)) {
    throw new Error(`ReLight presets file not found: ${RELIGHT_PRESETS_PATH}`)
  }
  
  const data = await readFile(RELIGHT_PRESETS_PATH, 'utf-8')
  cachedRelightPresets = JSON.parse(data)
  return cachedRelightPresets!
}

export async function getRelightPresets(): Promise<Preset[]> {
  const file = await loadRelightPresets()
  return file.presets
}

export async function getRelightPreset(presetId: string): Promise<Preset | null> {
  const file = await loadRelightPresets()
  return file.presets.find(p => p.id === presetId) || null
}

export function clearRelightPresetsCache(): void {
  cachedRelightPresets = null
}
