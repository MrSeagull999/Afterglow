import { create } from 'zustand'

export type ImageStatus = 
  | 'pending'
  | 'preview_generating'
  | 'preview_ready'
  | 'approved'
  | 'rejected'
  | 'final_generating'
  | 'final_ready'
  | 'error'

export type PreviewModel = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview'
export type FinalModel = 'gemini-3-pro-image-preview'
export type SeedStrategy = 'randomPerImage' | 'fixedPerRun'
export type LightingCondition = 'overcast' | 'sunny'

export interface ImageEntry {
  path: string
  name: string
  status: ImageStatus
  presetId: string
  previewPath?: string
  finalPath?: string
  thumbnailPath?: string
  thumbnailBase64?: string
  error?: string
  progress?: number
  previewSeed?: number | null
  finalSeed?: number | null
  previewModel?: string
  finalModel?: string
}

export interface Run {
  id: string
  inputDir: string
  listingName: string
  outputDir: string
  defaultPresetId: string
  images: ImageEntry[]
  mode: 'preview' | 'final' | 'idle'
  createdAt: string
  updatedAt: string
  batchId?: string
  batchStatus?: 'pending' | 'processing' | 'completed' | 'failed'
  lightingCondition?: LightingCondition
}

export interface Preset {
  id: string
  label: string
  description: string
  promptTemplate: string
  settings: {
    previewWidth: number
    finalImageSize: string
    outputFormatDefault: string
  }
}

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

export interface CostEstimate {
  previewCount: number
  previewCostPerImage: number
  previewTotalCost: number
  finalCount: number
  finalCostPerImage: number
  finalTotalCost: number
  totalCost: number
}

type View = 'home' | 'run' | 'jobs' | 'job'
type Filter = 'all' | 'approved' | 'rejected' | 'pending' | 'preview_ready' | 'final_ready' | 'error'

interface AppState {
  view: View
  currentRunId: string | null
  currentRun: Run | null
  runs: Run[]
  presets: Preset[]
  selectedPresetId: string
  selectedImages: Set<string>
  filter: Filter
  settings: Settings
  costEstimate: CostEstimate | null
  isLoading: boolean
  isProcessing: boolean
  processingStage: string
  compareModalOpen: boolean
  compareImagePath: string | null
  settingsModalOpen: boolean
  toasts: Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>
  
  setView: (view: View) => void
  setCurrentRunId: (runId: string | null) => void
  setCurrentRun: (run: Run | null) => void
  setRuns: (runs: Run[]) => void
  setPresets: (presets: Preset[]) => void
  setSelectedPresetId: (presetId: string) => void
  toggleImageSelection: (imagePath: string) => void
  selectAllImages: () => void
  deselectAllImages: () => void
  setFilter: (filter: Filter) => void
  setSettings: (settings: Settings) => void
  setCostEstimate: (estimate: CostEstimate | null) => void
  setIsLoading: (loading: boolean) => void
  setIsProcessing: (processing: boolean) => void
  setProcessingStage: (stage: string) => void
  openCompareModal: (imagePath: string) => void
  closeCompareModal: () => void
  openSettingsModal: () => void
  closeSettingsModal: () => void
  addToast: (message: string, type: 'success' | 'error' | 'info') => void
  removeToast: (id: string) => void
  updateImageInRun: (imagePath: string, updates: Partial<ImageEntry>) => void
  approveSelectedImages: () => void
  rejectSelectedImages: () => void
  setImagePreset: (imagePath: string, presetId: string) => void
  applyPresetToSelected: (presetId: string) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  view: 'home',
  currentRunId: null,
  currentRun: null,
  runs: [],
  presets: [],
  selectedPresetId: 'twilight_exterior_classic',
  selectedImages: new Set(),
  filter: 'all',
  settings: {
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
  },
  costEstimate: null,
  isLoading: false,
  isProcessing: false,
  processingStage: '',
  compareModalOpen: false,
  compareImagePath: null,
  settingsModalOpen: false,
  toasts: [],
  
  setView: (view) => set({ view }),
  setCurrentRunId: (runId) => set({ currentRunId: runId }),
  setCurrentRun: (run) => set({ currentRun: run }),
  setRuns: (runs) => set({ runs }),
  setPresets: (presets) => set({ presets }),
  setSelectedPresetId: (presetId) => set({ selectedPresetId: presetId }),
  
  toggleImageSelection: (imagePath) => set((state) => {
    const newSelected = new Set(state.selectedImages)
    if (newSelected.has(imagePath)) {
      newSelected.delete(imagePath)
    } else {
      newSelected.add(imagePath)
    }
    return { selectedImages: newSelected }
  }),
  
  selectAllImages: () => set((state) => {
    if (!state.currentRun) return state
    const filtered = getFilteredImages(state.currentRun.images, state.filter)
    return { selectedImages: new Set(filtered.map(img => img.path)) }
  }),
  
  deselectAllImages: () => set({ selectedImages: new Set() }),
  
  setFilter: (filter) => set({ filter }),
  setSettings: (settings) => set({ settings }),
  setCostEstimate: (estimate) => set({ costEstimate: estimate }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsProcessing: (processing) => set({ isProcessing: processing }),
  setProcessingStage: (stage) => set({ processingStage: stage }),
  
  openCompareModal: (imagePath) => set({ compareModalOpen: true, compareImagePath: imagePath }),
  closeCompareModal: () => set({ compareModalOpen: false, compareImagePath: null }),
  openSettingsModal: () => set({ settingsModalOpen: true }),
  closeSettingsModal: () => set({ settingsModalOpen: false }),
  
  addToast: (message, type) => set((state) => ({
    toasts: [...state.toasts, { id: `${Date.now()}-${Math.random()}`, message, type }]
  })),
  
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id)
  })),
  
  updateImageInRun: (imagePath, updates) => set((state) => {
    if (!state.currentRun) return state
    const updatedImages = state.currentRun.images.map(img => 
      img.path === imagePath ? { ...img, ...updates } : img
    )
    return { currentRun: { ...state.currentRun, images: updatedImages } }
  }),
  
  approveSelectedImages: () => set((state) => {
    if (!state.currentRun) return state
    const updatedImages = state.currentRun.images.map(img => 
      state.selectedImages.has(img.path) && img.status === 'preview_ready'
        ? { ...img, status: 'approved' as ImageStatus }
        : img
    )
    return { 
      currentRun: { ...state.currentRun, images: updatedImages },
      selectedImages: new Set()
    }
  }),
  
  rejectSelectedImages: () => set((state) => {
    if (!state.currentRun) return state
    const updatedImages = state.currentRun.images.map(img => 
      state.selectedImages.has(img.path)
        ? { ...img, status: 'rejected' as ImageStatus }
        : img
    )
    return { 
      currentRun: { ...state.currentRun, images: updatedImages },
      selectedImages: new Set()
    }
  }),
  
  setImagePreset: (imagePath, presetId) => set((state) => {
    if (!state.currentRun) return state
    const updatedImages = state.currentRun.images.map(img => 
      img.path === imagePath ? { ...img, presetId } : img
    )
    return { currentRun: { ...state.currentRun, images: updatedImages } }
  }),
  
  applyPresetToSelected: (presetId) => set((state) => {
    if (!state.currentRun) return state
    const updatedImages = state.currentRun.images.map(img => 
      state.selectedImages.has(img.path) ? { ...img, presetId } : img
    )
    return { currentRun: { ...state.currentRun, images: updatedImages } }
  })
}))

function getFilteredImages(images: ImageEntry[], filter: Filter): ImageEntry[] {
  switch (filter) {
    case 'approved':
      return images.filter(img => img.status === 'approved')
    case 'rejected':
      return images.filter(img => img.status === 'rejected')
    case 'pending':
      return images.filter(img => img.status === 'pending')
    case 'preview_ready':
      return images.filter(img => img.status === 'preview_ready')
    case 'final_ready':
      return images.filter(img => img.status === 'final_ready')
    case 'error':
      return images.filter(img => img.status === 'error')
    default:
      return images
  }
}

export { getFilteredImages }
