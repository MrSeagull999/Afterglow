import { create } from 'zustand'
import type { Version, ModuleType, VersionStatus } from '../../shared/types'

export interface LibraryVersion extends Version {
  sceneName: string
  assetName: string
}

export interface LibraryQuery {
  jobId: string
  module?: ModuleType
  status?: VersionStatus | VersionStatus[]
  sceneId?: string
  assetId?: string
  qualityTier?: 'preview' | 'final'
  approvedOnly?: boolean
  finalOnly?: boolean
}

export interface JobStats {
  totalAssets: number
  totalVersions: number
  versionsByModule: Record<ModuleType, number>
  approvedCount: number
  finalCount: number
}

interface LibraryState {
  // Query results
  libraryVersions: LibraryVersion[]
  chainableVersions: LibraryVersion[]
  jobStats: JobStats | null

  // Filters
  currentQuery: LibraryQuery | null
  moduleFilter: ModuleType | null
  statusFilter: VersionStatus | null

  // Selection for chaining
  selectedSourceVersionId: string | null

  // Loading
  isLoading: boolean

  // Actions
  queryLibrary: (query: LibraryQuery) => Promise<void>
  loadVersionsForChaining: (jobId: string, targetModule: ModuleType) => Promise<void>
  loadCleanSlateOutputsForStaging: (jobId: string, sceneId?: string) => Promise<void>
  loadStagedVersionsForScene: (jobId: string, sceneId: string) => Promise<void>
  loadVersionsByModule: (jobId: string, module: ModuleType) => Promise<void>
  loadApprovedVersions: (jobId: string) => Promise<void>
  loadFinalVersions: (jobId: string) => Promise<void>
  loadJobStats: (jobId: string) => Promise<void>

  // Filters
  setModuleFilter: (module: ModuleType | null) => void
  setStatusFilter: (status: VersionStatus | null) => void
  clearFilters: () => void

  // Selection
  setSelectedSourceVersionId: (versionId: string | null) => void

  // Reset
  resetLibrary: () => void
}

export const useLibraryStore = create<LibraryState>((set) => ({
  // Initial state
  libraryVersions: [],
  chainableVersions: [],
  jobStats: null,
  currentQuery: null,
  moduleFilter: null,
  statusFilter: null,
  selectedSourceVersionId: null,
  isLoading: false,

  // Query actions
  queryLibrary: async (query) => {
    set({ isLoading: true, currentQuery: query })
    try {
      const versions = await window.api.invoke('library:query', query)
      set({ libraryVersions: versions, isLoading: false })
    } catch (error) {
      console.error('Failed to query library:', error)
      set({ isLoading: false })
    }
  },

  loadVersionsForChaining: async (jobId, targetModule) => {
    set({ isLoading: true })
    try {
      const versions = await window.api.invoke('library:getVersionsForChaining', jobId, targetModule)
      set({ chainableVersions: versions, isLoading: false })
    } catch (error) {
      console.error('Failed to load chainable versions:', error)
      set({ isLoading: false })
    }
  },

  loadCleanSlateOutputsForStaging: async (jobId, sceneId) => {
    set({ isLoading: true })
    try {
      const versions = await window.api.invoke('library:getCleanSlateOutputsForStaging', jobId, sceneId)
      set({ chainableVersions: versions, isLoading: false })
    } catch (error) {
      console.error('Failed to load clean slate outputs:', error)
      set({ isLoading: false })
    }
  },

  loadStagedVersionsForScene: async (jobId, sceneId) => {
    set({ isLoading: true })
    try {
      const versions = await window.api.invoke('library:getStagedVersionsForScene', jobId, sceneId)
      set({ libraryVersions: versions, isLoading: false })
    } catch (error) {
      console.error('Failed to load staged versions:', error)
      set({ isLoading: false })
    }
  },

  loadVersionsByModule: async (jobId, module) => {
    set({ isLoading: true, moduleFilter: module })
    try {
      const versions = await window.api.invoke('library:getVersionsByModule', jobId, module)
      set({ libraryVersions: versions, isLoading: false })
    } catch (error) {
      console.error('Failed to load versions by module:', error)
      set({ isLoading: false })
    }
  },

  loadApprovedVersions: async (jobId) => {
    set({ isLoading: true })
    try {
      const versions = await window.api.invoke('library:getApprovedVersions', jobId)
      set({ libraryVersions: versions, isLoading: false })
    } catch (error) {
      console.error('Failed to load approved versions:', error)
      set({ isLoading: false })
    }
  },

  loadFinalVersions: async (jobId) => {
    set({ isLoading: true })
    try {
      const versions = await window.api.invoke('library:getFinalVersions', jobId)
      set({ libraryVersions: versions, isLoading: false })
    } catch (error) {
      console.error('Failed to load final versions:', error)
      set({ isLoading: false })
    }
  },

  loadJobStats: async (jobId) => {
    try {
      const stats = await window.api.invoke('library:getJobStats', jobId)
      set({ jobStats: stats })
    } catch (error) {
      console.error('Failed to load job stats:', error)
    }
  },

  // Filters
  setModuleFilter: (module) => set({ moduleFilter: module }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  clearFilters: () => set({ moduleFilter: null, statusFilter: null }),

  // Selection
  setSelectedSourceVersionId: (versionId) => set({ selectedSourceVersionId: versionId }),

  // Reset
  resetLibrary: () =>
    set({
      libraryVersions: [],
      chainableVersions: [],
      jobStats: null,
      currentQuery: null,
      moduleFilter: null,
      statusFilter: null,
      selectedSourceVersionId: null
    })
}))
