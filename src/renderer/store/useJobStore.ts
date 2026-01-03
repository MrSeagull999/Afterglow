import { create } from 'zustand'
import type { Job, Scene, Asset, Version, JobMetadata, ModuleType } from '../../shared/types'

interface JobState {
  // Current job context
  currentJob: Job | null
  currentScene: Scene | null
  currentAsset: Asset | null

  // Lists
  jobs: Job[]
  scenes: Scene[]
  assets: Asset[]
  versions: Version[]

  // Selection state
  selectedAssetIds: Set<string>
  selectedVersionId: string | null

  // Loading states
  isLoadingJobs: boolean
  isLoadingScenes: boolean
  isLoadingAssets: boolean
  isLoadingVersions: boolean

  // Actions - Jobs
  setJobs: (jobs: Job[]) => void
  setCurrentJob: (job: Job | null) => void
  loadJobs: () => Promise<void>
  createJob: (name: string, metadata?: JobMetadata) => Promise<Job>
  updateJob: (jobId: string, updates: Partial<Job>) => Promise<void>
  deleteJob: (jobId: string) => Promise<void>

  // Actions - Scenes
  setScenes: (scenes: Scene[]) => void
  setCurrentScene: (scene: Scene | null) => void
  loadScenesForJob: (jobId: string) => Promise<void>
  createScene: (jobId: string, name: string) => Promise<Scene>
  updateScene: (jobId: string, sceneId: string, updates: Partial<Scene>) => Promise<void>
  deleteScene: (jobId: string, sceneId: string) => Promise<void>
  setMasterAsset: (jobId: string, sceneId: string, assetId: string) => Promise<void>

  // Actions - Assets
  setAssets: (assets: Asset[]) => void
  setCurrentAsset: (asset: Asset | null) => void
  loadAssetsForJob: (jobId: string) => Promise<void>
  loadAssetsForScene: (jobId: string, sceneId: string) => Promise<void>
  createAsset: (jobId: string, sceneId: string | undefined, name: string, sourcePath: string) => Promise<Asset>
  updateAsset: (jobId: string, assetId: string, updates: Partial<Asset>) => Promise<void>
  deleteAsset: (jobId: string, assetId: string) => Promise<void>
  toggleAssetSelection: (assetId: string) => void
  selectAllAssets: () => void
  deselectAllAssets: () => void

  // Actions - Versions
  setVersions: (versions: Version[]) => void
  setSelectedVersionId: (versionId: string | null) => void
  loadVersionsForAsset: (jobId: string, assetId: string) => Promise<void>
  approveVersion: (jobId: string, versionId: string) => Promise<void>
  unapproveVersion: (jobId: string, versionId: string) => Promise<void>
  deleteVersion: (jobId: string, versionId: string) => Promise<void>
  duplicateVersion: (jobId: string, versionId: string, modifications?: { module?: ModuleType }) => Promise<Version>
  deletePreviewsExceptApproved: (jobId: string, assetId: string) => Promise<number>

  // Reset
  resetJobContext: () => void
}

export const useJobStore = create<JobState>((set, get) => ({
  // Initial state
  currentJob: null,
  currentScene: null,
  currentAsset: null,
  jobs: [],
  scenes: [],
  assets: [],
  versions: [],
  selectedAssetIds: new Set(),
  selectedVersionId: null,
  isLoadingJobs: false,
  isLoadingScenes: false,
  isLoadingAssets: false,
  isLoadingVersions: false,

  // Jobs
  setJobs: (jobs) => set({ jobs }),
  setCurrentJob: (job) => set({ currentJob: job }),

  loadJobs: async () => {
    set({ isLoadingJobs: true })
    try {
      const jobs = await window.api.invoke('job:list')
      set({ jobs, isLoadingJobs: false })
    } catch (error) {
      console.error('Failed to load jobs:', error)
      set({ isLoadingJobs: false })
    }
  },

  createJob: async (name, metadata) => {
    const job = await window.api.invoke('job:create', { name, metadata })
    set((state) => ({ jobs: [job, ...state.jobs] }))
    return job
  },

  updateJob: async (jobId, updates) => {
    const updatedJob = await window.api.invoke('job:update', jobId, updates)
    if (updatedJob) {
      set((state) => ({
        jobs: state.jobs.map((j) => (j.id === jobId ? updatedJob : j)),
        currentJob: state.currentJob?.id === jobId ? updatedJob : state.currentJob
      }))
    }
  },

  deleteJob: async (jobId) => {
    await window.api.invoke('job:delete', jobId)
    set((state) => ({
      jobs: state.jobs.filter((j) => j.id !== jobId),
      currentJob: state.currentJob?.id === jobId ? null : state.currentJob
    }))
  },

  // Scenes
  setScenes: (scenes) => set({ scenes }),
  setCurrentScene: (scene) => set({ currentScene: scene }),

  loadScenesForJob: async (jobId) => {
    set({ isLoadingScenes: true })
    try {
      const scenes = await window.api.invoke('scene:listForJob', jobId)
      set({ scenes, isLoadingScenes: false })
    } catch (error) {
      console.error('Failed to load scenes:', error)
      set({ isLoadingScenes: false })
    }
  },

  createScene: async (jobId, name) => {
    const scene = await window.api.invoke('scene:create', { jobId, name })
    set((state) => ({ scenes: [...state.scenes, scene] }))
    return scene
  },

  updateScene: async (jobId, sceneId, updates) => {
    const updatedScene = await window.api.invoke('scene:update', jobId, sceneId, updates)
    if (updatedScene) {
      set((state) => ({
        scenes: state.scenes.map((s) => (s.id === sceneId ? updatedScene : s)),
        currentScene: state.currentScene?.id === sceneId ? updatedScene : state.currentScene
      }))
    }
  },

  deleteScene: async (jobId, sceneId) => {
    await window.api.invoke('scene:delete', jobId, sceneId)
    set((state) => ({
      scenes: state.scenes.filter((s) => s.id !== sceneId),
      currentScene: state.currentScene?.id === sceneId ? null : state.currentScene
    }))
  },

  setMasterAsset: async (jobId, sceneId, assetId) => {
    const updatedScene = await window.api.invoke('scene:setMasterAsset', jobId, sceneId, assetId)
    if (updatedScene) {
      set((state) => ({
        scenes: state.scenes.map((s) => (s.id === sceneId ? updatedScene : s)),
        currentScene: state.currentScene?.id === sceneId ? updatedScene : state.currentScene
      }))
    }
  },

  // Assets
  setAssets: (assets) => set({ assets }),
  setCurrentAsset: (asset) => set({ currentAsset: asset }),

  loadAssetsForJob: async (jobId) => {
    set({ isLoadingAssets: true })
    try {
      const assets = await window.api.invoke('asset:listForJob', jobId)
      set({ assets, isLoadingAssets: false })
    } catch (error) {
      console.error('Failed to load assets for job:', error)
      set({ isLoadingAssets: false })
    }
  },

  loadAssetsForScene: async (jobId, sceneId) => {
    set({ isLoadingAssets: true })
    try {
      const assets = await window.api.invoke('asset:listForScene', jobId, sceneId)
      set({ assets, isLoadingAssets: false })
    } catch (error) {
      console.error('Failed to load assets:', error)
      set({ isLoadingAssets: false })
    }
  },

  createAsset: async (jobId, sceneId, name, sourcePath) => {
    const asset = await window.api.invoke('asset:create', { jobId, sceneId, name, sourcePath })
    set((state) => ({ assets: [...state.assets, asset] }))
    return asset
  },

  updateAsset: async (jobId, assetId, updates) => {
    const updatedAsset = await window.api.invoke('asset:update', jobId, assetId, updates)
    if (updatedAsset) {
      set((state) => ({
        assets: state.assets.map((a) => (a.id === assetId ? updatedAsset : a)),
        currentAsset: state.currentAsset?.id === assetId ? updatedAsset : state.currentAsset
      }))
    }
  },

  deleteAsset: async (jobId, assetId) => {
    await window.api.invoke('asset:delete', jobId, assetId)
    set((state) => ({
      assets: state.assets.filter((a) => a.id !== assetId),
      currentAsset: state.currentAsset?.id === assetId ? null : state.currentAsset,
      selectedAssetIds: new Set([...state.selectedAssetIds].filter((id) => id !== assetId))
    }))
  },

  toggleAssetSelection: (assetId) =>
    set((state) => {
      const newSelected = new Set(state.selectedAssetIds)
      if (newSelected.has(assetId)) {
        newSelected.delete(assetId)
      } else {
        newSelected.add(assetId)
      }
      return { selectedAssetIds: newSelected }
    }),

  selectAllAssets: () =>
    set((state) => ({
      selectedAssetIds: new Set(state.assets.map((a) => a.id))
    })),

  deselectAllAssets: () => set({ selectedAssetIds: new Set() }),

  // Versions
  setVersions: (versions) => set({ versions }),
  setSelectedVersionId: (versionId) => set({ selectedVersionId: versionId }),

  loadVersionsForAsset: async (jobId, assetId) => {
    set({ isLoadingVersions: true })
    try {
      const versions = await window.api.invoke('version:listForAsset', jobId, assetId)
      set({ versions, isLoadingVersions: false })
    } catch (error) {
      console.error('Failed to load versions:', error)
      set({ isLoadingVersions: false })
    }
  },

  approveVersion: async (jobId, versionId) => {
    const updatedVersion = await window.api.invoke('version:approve', jobId, versionId)
    if (updatedVersion) {
      set((state) => ({
        versions: state.versions.map((v) => (v.id === versionId ? updatedVersion : v))
      }))
    }
  },

  unapproveVersion: async (jobId, versionId) => {
    const updatedVersion = await window.api.invoke('version:unapprove', jobId, versionId)
    if (updatedVersion) {
      set((state) => ({
        versions: state.versions.map((v) => (v.id === versionId ? updatedVersion : v))
      }))
    }
  },

  deleteVersion: async (jobId, versionId) => {
    const deleted = await window.api.invoke('version:delete', jobId, versionId)
    if (deleted) {
      set((state) => ({
        versions: state.versions.filter((v) => v.id !== versionId),
        selectedVersionId: state.selectedVersionId === versionId ? null : state.selectedVersionId
      }))
    }
  },

  duplicateVersion: async (jobId, versionId, modifications) => {
    const newVersion = await window.api.invoke('version:duplicate', jobId, versionId, modifications)
    if (newVersion) {
      set((state) => ({ versions: [newVersion, ...state.versions] }))
    }
    return newVersion
  },

  deletePreviewsExceptApproved: async (jobId, assetId) => {
    const count = await window.api.invoke('version:deletePreviewsExceptApproved', jobId, assetId)
    await get().loadVersionsForAsset(jobId, assetId)
    return count
  },

  // Reset
  resetJobContext: () =>
    set({
      currentJob: null,
      currentScene: null,
      currentAsset: null,
      scenes: [],
      assets: [],
      versions: [],
      selectedAssetIds: new Set(),
      selectedVersionId: null
    })
}))
