import { create } from 'zustand'
import type { ModuleType, Injector, Version, VersionStatus, QualityTier } from '../../shared/types'
import type { RenovateChanges } from '../../main/core/modules/interior/renovate/renovatePrompts'

interface Guardrail {
  id: string
  label: string
  promptFragment: string
  appliesTo: ModuleType[]
}

// Shared input selection for all modules
export interface ModuleInput {
  type: 'original' | 'version'
  assetId: string
  assetName: string
  versionId?: string
  versionStatus?: VersionStatus
  qualityTier?: QualityTier
  thumbnailPath?: string
}

// Batch execution state
interface BatchExecutionState {
  isRunning: boolean
  totalCount: number
  completedCount: number
  failedIds: Set<string>
  results: Map<string, { versionId: string; status: VersionStatus }>
}

interface ModuleState {
  // Active module
  activeModule: ModuleType | null

  // Shared input selection (used by all modules) - DEPRECATED, use grid selection
  selectedInput: ModuleInput | null

  // Batch execution
  batchExecution: BatchExecutionState

  // Injectors & Guardrails
  injectors: Injector[]
  guardrails: Guardrail[]
  selectedInjectorIds: Set<string>
  selectedGuardrailIds: Set<string>

  // Module-specific settings
  cleanSlateSettings: {
    sourceVersionId: string | null
    customInstructions: string
  }

  stagingSettings: {
    sourceVersionId: string | null
    roomType: string
    style: string
    isMasterView: boolean
    masterVersionId: string | null
    furnitureSpecId: string | null
    customInstructions: string
  }

  renovateSettings: {
    sourceVersionId: string | null
    changes: RenovateChanges
    customInstructions: string
  }

  twilightSettings: {
    sourceVersionId: string | null
    presetId: string
    lightingCondition: 'overcast' | 'sunny'
    customInstructions: string
  }

  // Generation state
  isGenerating: boolean
  generatingVersionId: string | null

  // Constants from backend
  roomTypes: string[]
  stagingStyles: string[]
  floorMaterials: string[]
  floorColors: string[]
  wallColors: string[]
  curtainStyles: string[]

  // Actions
  setActiveModule: (module: ModuleType | null) => void
  setSelectedInput: (input: ModuleInput | null) => void
  loadInjectorsForModule: (module: ModuleType) => Promise<void>
  loadGuardrailsForModule: (module: ModuleType) => Promise<void>
  toggleInjector: (injectorId: string) => void
  toggleGuardrail: (guardrailId: string) => void
  resetInjectorSelection: () => void
  resetGuardrailSelection: () => void

  // Clean Slate
  setCleanSlateSourceVersion: (versionId: string | null) => void
  setCleanSlateCustomInstructions: (instructions: string) => void

  // Staging
  setStagingSourceVersion: (versionId: string | null) => void
  setStagingRoomType: (roomType: string) => void
  setStagingStyle: (style: string) => void
  setStagingIsMasterView: (isMaster: boolean) => void
  setStagingMasterVersion: (versionId: string | null) => void
  setStagingFurnitureSpec: (specId: string | null) => void
  setStagingCustomInstructions: (instructions: string) => void

  // Renovate
  setRenovateSourceVersion: (versionId: string | null) => void
  setRenovateChanges: (changes: RenovateChanges) => void
  setRenovateCustomInstructions: (instructions: string) => void

  // Twilight
  setTwilightSourceVersion: (versionId: string | null) => void
  setTwilightPresetId: (presetId: string) => void
  setTwilightLightingCondition: (condition: 'overcast' | 'sunny') => void
  setTwilightCustomInstructions: (instructions: string) => void

  // Generation
  setIsGenerating: (isGenerating: boolean) => void
  setGeneratingVersionId: (versionId: string | null) => void

  // Load constants
  loadConstants: () => Promise<void>

  // Reset
  resetModuleSettings: () => void
}

const defaultRenovateChanges: RenovateChanges = {
  floor: { enabled: false, material: 'hardwood' },
  wallPaint: { enabled: false, color: 'white' },
  curtains: { enabled: false, style: 'sheer' }
}

export const useModuleStore = create<ModuleState>((set, get) => ({
  // Initial state
  activeModule: null,
  selectedInput: null,
  
  // Batch execution initial state
  batchExecution: {
    isRunning: false,
    totalCount: 0,
    completedCount: 0,
    failedIds: new Set(),
    results: new Map()
  },

  injectors: [],
  guardrails: [],
  selectedInjectorIds: new Set(),
  selectedGuardrailIds: new Set(),

  cleanSlateSettings: {
    sourceVersionId: null,
    customInstructions: ''
  },

  stagingSettings: {
    sourceVersionId: null,
    roomType: 'living room',
    style: 'modern contemporary',
    isMasterView: true,
    masterVersionId: null,
    furnitureSpecId: null,
    customInstructions: ''
  },

  renovateSettings: {
    sourceVersionId: null,
    changes: defaultRenovateChanges,
    customInstructions: ''
  },

  twilightSettings: {
    sourceVersionId: null,
    presetId: 'twilight_exterior_classic',
    lightingCondition: 'overcast',
    customInstructions: ''
  },

  isGenerating: false,
  generatingVersionId: null,

  roomTypes: [],
  stagingStyles: [],
  floorMaterials: [],
  floorColors: [],
  wallColors: [],
  curtainStyles: [],

  // Actions
  setActiveModule: (module) => set({ activeModule: module }),
  setSelectedInput: (input) => set({ selectedInput: input }),

  loadInjectorsForModule: async (module) => {
    try {
      const injectors = await window.api.invoke('injectors:getForModule', module)
      set({ injectors })
    } catch (error) {
      console.error('Failed to load injectors:', error)
    }
  },

  loadGuardrailsForModule: async (module) => {
    try {
      const guardrails = await window.api.invoke('guardrails:getForModule', module)
      set({
        guardrails,
        selectedGuardrailIds: new Set(guardrails.map((g: Guardrail) => g.id))
      })
    } catch (error) {
      console.error('Failed to load guardrails:', error)
    }
  },

  toggleInjector: (injectorId) =>
    set((state) => {
      const newSelected = new Set(state.selectedInjectorIds)
      if (newSelected.has(injectorId)) {
        newSelected.delete(injectorId)
      } else {
        newSelected.add(injectorId)
      }
      return { selectedInjectorIds: newSelected }
    }),

  toggleGuardrail: (guardrailId) =>
    set((state) => {
      const newSelected = new Set(state.selectedGuardrailIds)
      if (newSelected.has(guardrailId)) {
        newSelected.delete(guardrailId)
      } else {
        newSelected.add(guardrailId)
      }
      return { selectedGuardrailIds: newSelected }
    }),

  resetInjectorSelection: () => set({ selectedInjectorIds: new Set() }),

  resetGuardrailSelection: () =>
    set((state) => ({
      selectedGuardrailIds: new Set(state.guardrails.map((g) => g.id))
    })),

  // Clean Slate
  setCleanSlateSourceVersion: (versionId) =>
    set((state) => ({
      cleanSlateSettings: { ...state.cleanSlateSettings, sourceVersionId: versionId }
    })),

  setCleanSlateCustomInstructions: (instructions) =>
    set((state) => ({
      cleanSlateSettings: { ...state.cleanSlateSettings, customInstructions: instructions }
    })),

  // Staging
  setStagingSourceVersion: (versionId) =>
    set((state) => ({
      stagingSettings: { ...state.stagingSettings, sourceVersionId: versionId }
    })),

  setStagingRoomType: (roomType) =>
    set((state) => ({
      stagingSettings: { ...state.stagingSettings, roomType }
    })),

  setStagingStyle: (style) =>
    set((state) => ({
      stagingSettings: { ...state.stagingSettings, style }
    })),

  setStagingIsMasterView: (isMaster) =>
    set((state) => ({
      stagingSettings: { ...state.stagingSettings, isMasterView: isMaster }
    })),

  setStagingMasterVersion: (versionId) =>
    set((state) => ({
      stagingSettings: { ...state.stagingSettings, masterVersionId: versionId }
    })),

  setStagingFurnitureSpec: (specId) =>
    set((state) => ({
      stagingSettings: { ...state.stagingSettings, furnitureSpecId: specId }
    })),

  setStagingCustomInstructions: (instructions) =>
    set((state) => ({
      stagingSettings: { ...state.stagingSettings, customInstructions: instructions }
    })),

  // Renovate
  setRenovateSourceVersion: (versionId) =>
    set((state) => ({
      renovateSettings: { ...state.renovateSettings, sourceVersionId: versionId }
    })),

  setRenovateChanges: (changes) =>
    set((state) => ({
      renovateSettings: { ...state.renovateSettings, changes }
    })),

  setRenovateCustomInstructions: (instructions) =>
    set((state) => ({
      renovateSettings: { ...state.renovateSettings, customInstructions: instructions }
    })),

  // Twilight
  setTwilightSourceVersion: (versionId) =>
    set((state) => ({
      twilightSettings: { ...state.twilightSettings, sourceVersionId: versionId }
    })),

  setTwilightPresetId: (presetId) =>
    set((state) => ({
      twilightSettings: { ...state.twilightSettings, presetId }
    })),

  setTwilightLightingCondition: (condition) =>
    set((state) => ({
      twilightSettings: { ...state.twilightSettings, lightingCondition: condition }
    })),

  setTwilightCustomInstructions: (instructions) =>
    set((state) => ({
      twilightSettings: { ...state.twilightSettings, customInstructions: instructions }
    })),

  // Generation
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setGeneratingVersionId: (versionId) => set({ generatingVersionId: versionId }),

  // Load constants
  loadConstants: async () => {
    try {
      const [roomTypes, stagingStyles, floorMaterials, floorColors, wallColors, curtainStyles] =
        await Promise.all([
          window.api.invoke('constants:getRoomTypes'),
          window.api.invoke('constants:getStagingStyles'),
          window.api.invoke('constants:getFloorMaterials'),
          window.api.invoke('constants:getFloorColors'),
          window.api.invoke('constants:getWallColors'),
          window.api.invoke('constants:getCurtainStyles')
        ])
      set({ roomTypes, stagingStyles, floorMaterials, floorColors, wallColors, curtainStyles })
    } catch (error) {
      console.error('Failed to load constants:', error)
    }
  },

  // Reset
  resetModuleSettings: () =>
    set({
      activeModule: null,
      selectedInput: null,
      selectedInjectorIds: new Set(),
      cleanSlateSettings: { sourceVersionId: null, customInstructions: '' },
      stagingSettings: {
        sourceVersionId: null,
        roomType: 'living room',
        style: 'modern contemporary',
        isMasterView: true,
        masterVersionId: null,
        furnitureSpecId: null,
        customInstructions: ''
      },
      renovateSettings: {
        sourceVersionId: null,
        changes: defaultRenovateChanges,
        customInstructions: ''
      },
      twilightSettings: {
        sourceVersionId: null,
        presetId: 'twilight_exterior_classic',
        lightingCondition: 'overcast',
        customInstructions: ''
      },
      isGenerating: false,
      generatingVersionId: null
    })
}))
