import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import type { Injector, ModuleType } from '../../../../shared/types'

const INJECTORS_DIR = join(process.cwd(), 'prompt-bank', 'injectors')

let injectorCache: Map<ModuleType, Injector[]> = new Map()

export async function loadInjectorsForModule(module: ModuleType): Promise<Injector[]> {
  if (injectorCache.has(module)) {
    return injectorCache.get(module)!
  }

  const moduleToFile: Record<ModuleType, string> = {
    clean: 'cleanSlate.json',
    stage: 'staging.json',
    renovate: 'renovate.json',
    twilight: 'twilight.json'
  }

  const filePath = join(INJECTORS_DIR, moduleToFile[module])

  if (!existsSync(filePath)) {
    return []
  }

  try {
    const data = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(data)
    const injectors: Injector[] = parsed.injectors || []
    injectorCache.set(module, injectors)
    return injectors
  } catch {
    return []
  }
}

export async function getInjector(module: ModuleType, injectorId: string): Promise<Injector | null> {
  const injectors = await loadInjectorsForModule(module)
  return injectors.find(i => i.id === injectorId) || null
}

export async function getInjectorsByCategory(module: ModuleType, category: string): Promise<Injector[]> {
  const injectors = await loadInjectorsForModule(module)
  return injectors.filter(i => i.category === category)
}

export function buildInjectorPrompt(injectors: Injector[]): string {
  return injectors.map(i => i.promptFragment).join(' ')
}

export async function buildInjectorPromptFromIds(module: ModuleType, injectorIds: string[]): Promise<string> {
  const injectors = await loadInjectorsForModule(module)
  const selected = injectors.filter(i => injectorIds.includes(i.id))
  return buildInjectorPrompt(selected)
}

export function clearInjectorCache(): void {
  injectorCache.clear()
}

export async function reloadInjectors(module: ModuleType): Promise<Injector[]> {
  injectorCache.delete(module)
  return loadInjectorsForModule(module)
}
