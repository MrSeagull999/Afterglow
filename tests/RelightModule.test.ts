import { describe, it, expect, beforeEach } from 'vitest'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'

describe('ReLight Module Integration', () => {
  const PROMPT_BANK_DIR = join(process.cwd(), 'prompt-bank')
  const INJECTORS_DIR = join(PROMPT_BANK_DIR, 'injectors')

  describe('Preset Files', () => {
    it('should have relight-presets.json file', () => {
      const presetsPath = join(PROMPT_BANK_DIR, 'relight-presets.json')
      expect(existsSync(presetsPath)).toBe(true)
    })

    it('should have valid JSON structure in relight-presets.json', async () => {
      const presetsPath = join(PROMPT_BANK_DIR, 'relight-presets.json')
      const data = await readFile(presetsPath, 'utf-8')
      const parsed = JSON.parse(data)
      
      expect(parsed).toHaveProperty('defaultPresetId')
      expect(parsed).toHaveProperty('version')
      expect(parsed).toHaveProperty('presets')
      expect(Array.isArray(parsed.presets)).toBe(true)
    })

    it('should have 4 relight presets', async () => {
      const presetsPath = join(PROMPT_BANK_DIR, 'relight-presets.json')
      const data = await readFile(presetsPath, 'utf-8')
      const parsed = JSON.parse(data)
      
      expect(parsed.presets).toHaveLength(4)
    })

    it('should have required preset properties', async () => {
      const presetsPath = join(PROMPT_BANK_DIR, 'relight-presets.json')
      const data = await readFile(presetsPath, 'utf-8')
      const parsed = JSON.parse(data)
      
      parsed.presets.forEach((preset: any) => {
        expect(preset).toHaveProperty('id')
        expect(preset).toHaveProperty('label')
        expect(preset).toHaveProperty('description')
        expect(preset).toHaveProperty('promptTemplate')
        expect(preset).toHaveProperty('settings')
      })
    })

    it('should have Blue Hour Twilight as default preset', async () => {
      const presetsPath = join(PROMPT_BANK_DIR, 'relight-presets.json')
      const data = await readFile(presetsPath, 'utf-8')
      const parsed = JSON.parse(data)
      
      expect(parsed.defaultPresetId).toBe('relight_blue_hour')
      const defaultPreset = parsed.presets.find((p: any) => p.id === 'relight_blue_hour')
      expect(defaultPreset).toBeDefined()
    })
  })

  describe('Injector Files', () => {
    it('should have relight.json injector file', () => {
      const injectorPath = join(INJECTORS_DIR, 'relight.json')
      expect(existsSync(injectorPath)).toBe(true)
    })

    it('should have valid JSON structure in relight.json', async () => {
      const injectorPath = join(INJECTORS_DIR, 'relight.json')
      const data = await readFile(injectorPath, 'utf-8')
      const parsed = JSON.parse(data)
      
      expect(parsed).toHaveProperty('injectors')
      expect(Array.isArray(parsed.injectors)).toBe(true)
    })
  })

  describe('Module Files', () => {
    it('should have relightModule.ts', () => {
      const modulePath = join(process.cwd(), 'src/main/core/modules/relight/relightModule.ts')
      expect(existsSync(modulePath)).toBe(true)
    })

    it('should have relightPrompts.ts', () => {
      const promptsPath = join(process.cwd(), 'src/main/core/modules/relight/relightPrompts.ts')
      expect(existsSync(promptsPath)).toBe(true)
    })

    it('should have RelightPanel.tsx', () => {
      const panelPath = join(process.cwd(), 'src/renderer/components/modules/RelightPanel.tsx')
      expect(existsSync(panelPath)).toBe(true)
    })

    it('should have RelightSettings.tsx', () => {
      const settingsPath = join(process.cwd(), 'src/renderer/components/modules/settings/RelightSettings.tsx')
      expect(existsSync(settingsPath)).toBe(true)
    })
  })

  describe('Type System', () => {
    it('should include relight in ModuleType', async () => {
      const typesPath = join(process.cwd(), 'src/shared/types/index.ts')
      const content = await readFile(typesPath, 'utf-8')
      
      expect(content).toContain("'relight'")
      expect(content).toMatch(/ModuleType.*=.*'relight'/)
    })
  })

  describe('Consistency with Other Modules', () => {
    it('should have same preset structure as twilight', async () => {
      const relightPath = join(PROMPT_BANK_DIR, 'relight-presets.json')
      const twilightPath = join(PROMPT_BANK_DIR, 'presets.json')
      
      const relightData = JSON.parse(await readFile(relightPath, 'utf-8'))
      const twilightData = JSON.parse(await readFile(twilightPath, 'utf-8'))
      
      // Both should have same top-level structure
      expect(Object.keys(relightData).sort()).toEqual(Object.keys(twilightData).sort())
      
      // Both should have presets with same properties
      const relightPresetKeys = Object.keys(relightData.presets[0]).sort()
      const twilightPresetKeys = Object.keys(twilightData.presets[0]).sort()
      expect(relightPresetKeys).toEqual(twilightPresetKeys)
    })

    it('should have same injector structure as other modules', async () => {
      const relightPath = join(INJECTORS_DIR, 'relight.json')
      const twilightPath = join(INJECTORS_DIR, 'twilight.json')
      
      const relightData = JSON.parse(await readFile(relightPath, 'utf-8'))
      const twilightData = JSON.parse(await readFile(twilightPath, 'utf-8'))
      
      // Both should have injectors array
      expect(relightData).toHaveProperty('injectors')
      expect(twilightData).toHaveProperty('injectors')
      expect(Array.isArray(relightData.injectors)).toBe(true)
      expect(Array.isArray(twilightData.injectors)).toBe(true)
    })
  })
})
