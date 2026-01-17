import { create } from 'zustand'
import type { Job, Scene, Asset, Version, JobMetadata, ModuleType } from '../../shared/types'
import { resolveGenerationStatus } from '../../shared/resolveGenerationStatus'

export type BatchRun = {
  id: string
  moduleId: string
  startedAt: number
  assetIds: string[]
  createdVersionIdsByAssetId: Record<string, string>
  failedAssetIds?: string[]
  dismissed?: boolean
}

export type BatchRunCounts = {
  pending: number
  completed: number
  failed: number
}

let batchRunSeq = 0

export function getBatchRunCounts(params: {
  batchRun: BatchRun
  versionsByAssetId: Record<string, Version[]>
}): BatchRunCounts {
  let pending = 0
  let completed = 0
  let failed = 0

  const failedSet = new Set(params.batchRun.failedAssetIds || [])

  for (const assetId of params.batchRun.assetIds) {
    const createdId = params.batchRun.createdVersionIdsByAssetId[assetId]

    if (!createdId) {
      if (failedSet.has(assetId)) {
        failed += 1
      } else {
        pending += 1
      }
      continue
    }

    const versions = params.versionsByAssetId[assetId] || []
    const v = versions.find((x) => x.id === createdId)
    if (!v) {
      pending += 1
      continue
    }

    const status = resolveGenerationStatus(v)
    if (status === 'pending') pending += 1
    else if (status === 'completed') completed += 1
    else if (status === 'failed') failed += 1
    else pending += 1
  }

  return { pending, completed, failed }
}

export function getNextBatchAssetIdByPredicate(params: {
  batchRun: BatchRun
  versionsByAssetId: Record<string, Version[]>
  currentAssetId: string | null
  predicate: (status: 'idle' | 'pending' | 'completed' | 'failed', assetId: string) => boolean
}): string | null {
  const ids = params.batchRun.assetIds
  if (ids.length === 0) return null

  const failedSet = new Set(params.batchRun.failedAssetIds || [])

  const startIdx = (() => {
    if (!params.currentAssetId) return -1
    const idx = ids.indexOf(params.currentAssetId)
    return idx >= 0 ? idx : -1
  })()

  for (let offset = 1; offset <= ids.length; offset++) {
    const idx = (startIdx + offset + ids.length) % ids.length
    const assetId = ids[idx]

    const createdId = params.batchRun.createdVersionIdsByAssetId[assetId]
    const status = (() => {
      if (!createdId) {
        if (failedSet.has(assetId)) return 'failed' as const
        return 'pending' as const
      }
      const versions = params.versionsByAssetId[assetId] || []
      const v = versions.find((x) => x.id === createdId)
      return resolveGenerationStatus(v)
    })()

    if (params.predicate(status, assetId)) return assetId
  }

  return null
}

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

  // Versions cache (per asset) for version-aware MainStage
  versionsByAssetId: Record<string, Version[]>

  // MainStage viewing state
  viewedVersionIdByAssetId: Record<string, string | null>
  lastAppliedVersionIdByAssetId: Record<string, string | null>

  // Selection state
  selectedAssetIds: Set<string>
  selectedVersionId: string | null

  // Batch Run
  activeBatchRun?: BatchRun

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
  replaceAssetSelection: (assetId: string) => void
  addAssetToSelection: (assetId: string) => void
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

  // MainStage viewing helpers
  getAssetVersions: (assetId: string) => Version[]
  getAssetLatestVersion: (assetId: string) => Version | null
  getViewedVersionId: (assetId: string) => string | null
  setViewedVersionId: (assetId: string, versionId: string | null) => void
  setLastAppliedVersionId: (assetId: string, versionId: string | null) => void
  getLastAppliedVersionId: (assetId: string) => string | null

  // Optimistic version insertion (used for immediate UI feedback during batch apply)
  upsertVersionForAsset: (assetId: string, version: Version) => void
  createOptimisticPendingVersion: (params: {
    jobId: string
    assetId: string
    versionId: string
    module: ModuleType
    sourceVersionIds: string[]
  }) => Version

  // Batch Run
  startBatchRun: (params: {
    moduleId: string
    assetIds: string[]
    createdVersionIdsByAssetId: Record<string, string>
    failedAssetIds?: string[]
  }) => void
  dismissBatchRun: () => void
  jumpToBatchAsset: (assetId: string) => void
  jumpToNextFailedInBatchRun: () => void
  jumpToNextPendingInBatchRun: () => void
  jumpToNextCompletedInBatchRun: () => void
  getActiveBatchRunCounts: () => BatchRunCounts | null

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
  versionsByAssetId: {},
  viewedVersionIdByAssetId: {},
  lastAppliedVersionIdByAssetId: {},
  selectedAssetIds: new Set(),
  selectedVersionId: null,
  activeBatchRun: undefined,
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

  replaceAssetSelection: (assetId) =>
    set(() => ({
      selectedAssetIds: new Set([assetId])
    })),

  addAssetToSelection: (assetId) =>
    set((state) => {
      const next = new Set(state.selectedAssetIds)
      next.add(assetId)
      return { selectedAssetIds: next }
    }),

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
      set((state) => ({
        versions,
        versionsByAssetId: { ...state.versionsByAssetId, [assetId]: versions },
        isLoadingVersions: false
      }))
    } catch (error) {
      console.error('Failed to load versions:', error)
      set({ isLoadingVersions: false })
    }
  },

  approveVersion: async (jobId, versionId) => {
    const updated = await window.api.invoke('version:approve', jobId, versionId)
    if (!updated) return

    const updatedVersions = Array.isArray(updated) ? updated : [updated]
    set((state) => ({
      versions: state.versions.map((v) => {
        const match = updatedVersions.find((u) => u.id === v.id)
        return match ? match : v
      }),
      versionsByAssetId: Object.fromEntries(
        Object.entries(state.versionsByAssetId).map(([assetId, list]) => [
          assetId,
          list.map((v) => {
            const match = updatedVersions.find((u) => u.id === v.id)
            return match ? match : v
          })
        ])
      )
    }))
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
        selectedVersionId: state.selectedVersionId === versionId ? null : state.selectedVersionId,
        versionsByAssetId: Object.fromEntries(
          Object.entries(state.versionsByAssetId).map(([assetId, list]) => [
            assetId,
            list.filter((v) => v.id !== versionId)
          ])
        )
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

  getAssetVersions: (assetId) => {
    return get().versionsByAssetId[assetId] || []
  },

  getAssetLatestVersion: (assetId) => {
    const list = get().versionsByAssetId[assetId] || []
    if (list.length === 0) return null
    const sorted = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return sorted[0] || null
  },

  getViewedVersionId: (assetId) => {
    return get().viewedVersionIdByAssetId[assetId] || null
  },

  setViewedVersionId: (assetId, versionId) =>
    set((state) => ({
      viewedVersionIdByAssetId: { ...state.viewedVersionIdByAssetId, [assetId]: versionId }
    })),

  setLastAppliedVersionId: (assetId, versionId) =>
    set((state) => ({
      lastAppliedVersionIdByAssetId: { ...state.lastAppliedVersionIdByAssetId, [assetId]: versionId }
    })),

  getLastAppliedVersionId: (assetId) => {
    return get().lastAppliedVersionIdByAssetId[assetId] || null
  },

  upsertVersionForAsset: (assetId, version) =>
    set((state) => {
      const existing = state.versionsByAssetId[assetId] || []
      const idx = existing.findIndex((v) => v.id === version.id)
      const next = idx >= 0 ? existing.map((v) => (v.id === version.id ? version : v)) : [...existing, version]
      return {
        versionsByAssetId: { ...state.versionsByAssetId, [assetId]: next }
      }
    }),

  createOptimisticPendingVersion: (params) => {
    const now = Date.now()
    return {
      id: params.versionId,
      assetId: params.assetId,
      jobId: params.jobId,
      module: params.module,
      qualityTier: 'preview',
      status: 'generating',
      generationStatus: 'pending',
      startedAt: now,
      recipe: { basePrompt: '', injectors: [], guardrails: [], settings: {} },
      sourceVersionIds: params.sourceVersionIds,
      createdAt: new Date(now).toISOString()
    } as Version
  },

  startBatchRun: (params) =>
    set({
      activeBatchRun: {
        id: `${Date.now()}-${++batchRunSeq}`,
        moduleId: params.moduleId,
        startedAt: Date.now(),
        assetIds: params.assetIds,
        createdVersionIdsByAssetId: params.createdVersionIdsByAssetId,
        failedAssetIds: params.failedAssetIds,
        dismissed: false
      }
    }),

  dismissBatchRun: () =>
    set((state) => {
      if (!state.activeBatchRun) return state
      return { activeBatchRun: { ...state.activeBatchRun, dismissed: true } }
    }),

  jumpToBatchAsset: (assetId) =>
    set((state) => {
      const run = state.activeBatchRun
      const versionId = run?.createdVersionIdsByAssetId?.[assetId]

      if (!versionId) {
        return {
          selectedAssetIds: new Set([assetId])
        }
      }

      return {
        selectedAssetIds: new Set([assetId]),
        viewedVersionIdByAssetId: {
          ...state.viewedVersionIdByAssetId,
          [assetId]: versionId
        }
      }
    }),

  jumpToNextFailedInBatchRun: () => {
    const state = get()
    const run = state.activeBatchRun
    if (!run || run.dismissed) return

    const currentAssetId = state.selectedAssetIds.size === 1 ? Array.from(state.selectedAssetIds)[0] : null
    const next = getNextBatchAssetIdByPredicate({
      batchRun: run,
      versionsByAssetId: state.versionsByAssetId,
      currentAssetId,
      predicate: (status) => status === 'failed'
    })
    if (!next) return
    state.jumpToBatchAsset(next)
  },

  jumpToNextPendingInBatchRun: () => {
    const state = get()
    const run = state.activeBatchRun
    if (!run || run.dismissed) return

    const currentAssetId = state.selectedAssetIds.size === 1 ? Array.from(state.selectedAssetIds)[0] : null
    const next = getNextBatchAssetIdByPredicate({
      batchRun: run,
      versionsByAssetId: state.versionsByAssetId,
      currentAssetId,
      predicate: (status) => status === 'pending'
    })
    if (!next) return
    state.jumpToBatchAsset(next)
  },

  jumpToNextCompletedInBatchRun: () => {
    const state = get()
    const run = state.activeBatchRun
    if (!run || run.dismissed) return

    const currentAssetId = state.selectedAssetIds.size === 1 ? Array.from(state.selectedAssetIds)[0] : null
    const next = getNextBatchAssetIdByPredicate({
      batchRun: run,
      versionsByAssetId: state.versionsByAssetId,
      currentAssetId,
      predicate: (status) => status === 'completed'
    })
    if (!next) return
    state.jumpToBatchAsset(next)
  },

  getActiveBatchRunCounts: () => {
    const state = get()
    if (!state.activeBatchRun || state.activeBatchRun.dismissed) return null
    return getBatchRunCounts({ batchRun: state.activeBatchRun, versionsByAssetId: state.versionsByAssetId })
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
      versionsByAssetId: {},
      viewedVersionIdByAssetId: {},
      lastAppliedVersionIdByAssetId: {},
      selectedAssetIds: new Set(),
      selectedVersionId: null,
      activeBatchRun: undefined
    })
}))
