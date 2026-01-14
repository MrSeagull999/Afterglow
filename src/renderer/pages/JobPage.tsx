import React, { useEffect } from 'react'
import { useJobStore } from '../store/useJobStore'
import { useLibraryStore } from '../store/useLibraryStore'
import { useModuleStore } from '../store/useModuleStore'
import { useAppStore } from '../store/useAppStore'
import { ModuleGrid } from '../components/modules/ModuleGrid'
import { ThreeColumnLayout } from '../components/layout/ThreeColumnLayout'
import { MainStage } from '../components/mainstage/MainStage'
import { InspectorPanel } from '../inspector/InspectorPanel'
import { LibraryHeader } from '../components/library/LibraryHeader'
import { ToolDock } from '../components/toolDock/ToolDock'
import type { ModuleType } from '../../shared/types'
import {
  ArrowLeft,
  FolderOpen,
  Settings
} from 'lucide-react'

export function applyBatchGenerationResults(params: {
  assetIds: string[]
  results: unknown
  setLastAppliedVersionId: (assetId: string, versionId: string | null) => void
  setViewedVersionId: (assetId: string, versionId: string | null) => void
}): void {
  if (!Array.isArray(params.results)) return

  for (const r of params.results as any[]) {
    if (r?.assetId && r?.versionId) {
      params.setLastAppliedVersionId(r.assetId, r.versionId)
    }
  }

  if (params.assetIds.length === 1) {
    const assetId = params.assetIds[0]
    const match = (params.results as any[]).find((r) => r?.assetId === assetId && r?.versionId)
    if (match?.versionId) {
      params.setViewedVersionId(assetId, match.versionId)
    }
  }
}

export function getBatchRunMappingFromResults(results: unknown): {
  createdVersionIdsByAssetId: Record<string, string>
  failedAssetIds: string[]
} {
  const createdVersionIdsByAssetId: Record<string, string> = {}
  const failedAssetIds: string[] = []

  if (!Array.isArray(results)) {
    return { createdVersionIdsByAssetId, failedAssetIds }
  }

  for (const r of results as any[]) {
    const assetId = r?.assetId
    const versionId = r?.versionId
    if (typeof assetId !== 'string' || assetId.length === 0) continue
    if (typeof versionId === 'string' && versionId.length > 0) {
      createdVersionIdsByAssetId[assetId] = versionId
    } else {
      failedAssetIds.push(assetId)
    }
  }

  return { createdVersionIdsByAssetId, failedAssetIds }
}

export function JobPage() {
  const {
    currentJob,
    assets,
    selectedAssetIds,
    resetJobContext,
    loadAssetsForJob,
    getViewedVersionId,
    getAssetLatestVersion,
    loadVersionsForAsset,
    setLastAppliedVersionId,
    setViewedVersionId
  } = useJobStore()
  const { loadJobStats, jobStats } = useLibraryStore()
  const { 
    activeModule, 
    setActiveModule, 
    loadInjectorsForModule, 
    loadGuardrailsForModule,
    setIsGenerating
  } = useModuleStore()
  const { setView, addToast, openSettingsModal } = useAppStore()
  
  useEffect(() => {
    if (currentJob) {
      loadJobStats(currentJob.id)
      loadAssetsForJob(currentJob.id)
    }
  }, [currentJob?.id])

  const applyTargetLabel = (() => {
    const count = selectedAssetIds.size
    if (count === 0) return 'Applying to: (none)'
    if (count > 1) return 'Applying to: Latest version of each selected asset'

    const assetId = Array.from(selectedAssetIds)[0]
    const viewed = getViewedVersionId(assetId)
    if (!viewed) return 'Applying to: Original'
    return `Applying to: Version ${viewed}`
  })()

  // Load injectors/guardrails when module changes
  useEffect(() => {
    if (activeModule) {
      Promise.all([
        loadInjectorsForModule(activeModule),
        loadGuardrailsForModule(activeModule)
      ])
    }
  }, [activeModule])

  const handleBack = () => {
    resetJobContext()
    setView('home')
  }

  const handleApplyToSelected = async () => {
    if (!currentJob || !activeModule || selectedAssetIds.size === 0) {
      addToast('Select images first', 'error')
      return
    }

    setIsGenerating(true)
    try {
      // Batch execute for all selected assets
      const assetIds = Array.from(selectedAssetIds)

      // Determine per-asset source version mapping
      const sourceVersionIdByAssetId: Record<string, string> = {}
      if (assetIds.length === 1) {
        const assetId = assetIds[0]
        const viewed = getViewedVersionId(assetId)
        if (viewed) {
          sourceVersionIdByAssetId[assetId] = viewed
        } else {
          // stage/renovate support explicit original marker
          if (activeModule === 'stage' || activeModule === 'renovate') {
            sourceVersionIdByAssetId[assetId] = `original:${assetId}`
          }
        }
      } else {
        // Multi-select: apply uses latest version of each selected asset (safe default)
        for (const assetId of assetIds) {
          // Ensure cache is warm where possible
          await loadVersionsForAsset(currentJob.id, assetId)
          const latest = getAssetLatestVersion(assetId)
          if (latest?.id) {
            sourceVersionIdByAssetId[assetId] = latest.id
          } else if (activeModule === 'stage' || activeModule === 'renovate') {
            sourceVersionIdByAssetId[assetId] = `original:${assetId}`
          }
        }
      }
      
      const results = await window.api.invoke(`module:${activeModule}:batchGenerate`, {
        jobId: currentJob.id,
        assetIds,
        sourceVersionIdByAssetId,
        // Module-specific settings are read from the store by the backend
      })

      const { createdVersionIdsByAssetId, failedAssetIds } = getBatchRunMappingFromResults(results)

      useJobStore.getState().startBatchRun({
        moduleId: activeModule,
        assetIds,
        createdVersionIdsByAssetId,
        failedAssetIds
      })

      applyBatchGenerationResults({
        assetIds,
        results,
        setLastAppliedVersionId,
        setViewedVersionId
      })

      addToast(`Started ${activeModule} generation for ${assetIds.length} images`, 'success')
    } catch (error) {
      console.error('Batch generation failed:', error)
      addToast('Failed to start generation', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!currentJob) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-slate-400">
          <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No job selected</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Job Header */}
      <header className="flex-shrink-0 h-14 border-b border-slate-700 flex items-center px-4 gap-4 bg-slate-800/50">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-white truncate">{currentJob.name}</h1>
          {currentJob.metadata.address && (
            <p className="text-xs text-slate-400 truncate">{currentJob.metadata.address}</p>
          )}
        </div>

        {jobStats && (
          <div className="flex items-center gap-4 text-sm">
            <div className="text-slate-400">
              <span className="text-white font-medium">{jobStats.totalAssets}</span> assets
            </div>
            <div className="text-slate-400">
              <span className="text-emerald-400 font-medium">{jobStats.approvedCount}</span> approved
            </div>
            <div className="text-slate-400">
              <span className="text-amber-400 font-medium">{jobStats.finalCount}</span> finals
            </div>
          </div>
        )}

        <button 
          onClick={openSettingsModal}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <Settings className="w-5 h-5 text-slate-400" />
        </button>
      </header>

      {/* Main Content - Module Rail + Settings Panel + Grid */}
      <ThreeColumnLayout
        left={
          <>
            <LibraryHeader />
            <div className="flex-1 overflow-hidden">
              <ModuleGrid activeModule={activeModule} libraryMode />
            </div>
          </>
        }
        center={
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
              <MainStage selectedAssetIds={Array.from(selectedAssetIds)} assets={assets} />
            </div>
            <ToolDock
              activeModule={activeModule}
              onSelectModule={(m) => setActiveModule(m)}
            />
          </div>
        }
        right={
          <InspectorPanel
            activeModule={activeModule}
            selectedAssetIds={Array.from(selectedAssetIds)}
            assets={assets}
            applyTargetLabel={applyTargetLabel}
            onApply={handleApplyToSelected}
          />
        }
      />
    </div>
  )
}
