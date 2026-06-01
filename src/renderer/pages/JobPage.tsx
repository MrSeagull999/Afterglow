import React, { useEffect, useState, useMemo } from 'react'
import { useJobStore } from '../store/useJobStore'
import { useLibraryStore } from '../store/useLibraryStore'
import { useModuleStore } from '../store/useModuleStore'
import { useAppStore } from '../store/useAppStore'
import { ModuleGrid } from '../components/modules/ModuleGrid'
import { ThreeColumnLayout } from '../components/layout/ThreeColumnLayout'
import { MainStage } from '../components/mainstage/MainStage'
import { InspectorPanel } from '../inspector/InspectorPanel'
import { LibraryHeader } from '../components/library/LibraryHeader'
import { SourcePreviewPanel } from '../components/library/SourcePreviewPanel'
import { ToolDock } from '../components/toolDock/ToolDock'
import { BatchExportDialog } from '../components/export/BatchExportDialog'
import type { ModuleType } from '../../shared/types'
import {
  ArrowLeft,
  Download,
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
    versionsByAssetId,
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
    setIsGenerating,
    selectedInjectorIds,
    selectedGuardrailIds,
    twilightSettings,
    stagingSettings,
    renovateSettings,
    relightSettings,
    freeformSettings
  } = useModuleStore()
  const { setView, addToast, openSettingsModal } = useAppStore()
  const [batchExportOpen, setBatchExportOpen] = useState(false)

  // Collect all version IDs that have outputs (approved preferred, otherwise latest with output)
  const exportableVersionIds = useMemo(() => {
    const ids: string[] = []
    for (const asset of assets) {
      const versions = versionsByAssetId[asset.id] || []
      // Prefer approved version, then latest with output
      const approved = versions.find(v => v.lifecycleStatus === 'approved' && v.outputPath)
      if (approved) {
        ids.push(approved.id)
      } else {
        const withOutput = versions.filter(v => v.outputPath)
        if (withOutput.length > 0) {
          ids.push(withOutput[withOutput.length - 1].id)
        }
      }
    }
    return ids
  }, [assets, versionsByAssetId])

  useEffect(() => {
    if (currentJob) {
      loadJobStats(currentJob.id)
      loadAssetsForJob(currentJob.id)
    }
  }, [currentJob?.id])

  // Auto-reload assets when watch folder imports new images for this job
  useEffect(() => {
    const off = window.api.on('watchFolder:newAssets', (data: { jobId: string; count: number }) => {
      if (currentJob && data.jobId === currentJob.id) {
        loadAssetsForJob(currentJob.id)
        addToast(`${data.count} new image${data.count > 1 ? 's' : ''} imported from watch folder`, 'info')
      }
    })
    return off
  }, [currentJob?.id])

  const applyTargetLabel = (() => {
    const count = selectedAssetIds.size
    if (count === 0) return 'Applying to: (none)'
    if (count > 1) return 'Applying to: Original source images'

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

  const handleShowJobInFinder = async () => {
    if (!currentJob) return
    try {
      await window.api.invoke('job:showInFinder', currentJob.id)
    } catch (error) {
      addToast('Failed to show job folder in Finder', 'error')
    }
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
        for (const assetId of assetIds) {
          await loadVersionsForAsset(currentJob.id, assetId)
          if (activeModule === 'stage' || activeModule === 'renovate') {
            // For staging/renovate: source should be empty-room input.
            // Prefer latest ready clean-slate output, else fall back to original.
            const versions = useJobStore.getState().versionsByAssetId[assetId] || []
            const cleanSlateVersion = versions
              .filter(v => v.module === 'clean' && (v.status === 'hq_ready' || v.status === 'approved' || v.status === 'final_ready'))
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

            if (cleanSlateVersion?.id) {
              sourceVersionIdByAssetId[assetId] = cleanSlateVersion.id
            } else {
              sourceVersionIdByAssetId[assetId] = `original:${assetId}`
            }
          } else {
            const latest = getAssetLatestVersion(assetId)
            if (latest?.id) {
              sourceVersionIdByAssetId[assetId] = latest.id
            }
          }
        }
      }
      
      const baseParams: any = {
        jobId: currentJob.id,
        assetIds,
        sourceVersionIdByAssetId
      }

      if (activeModule === 'twilight') {
        const presets = await window.electronAPI.getPresets()
        const preset = presets.find((p: any) => p.id === twilightSettings.presetId)
        baseParams.presetId = twilightSettings.presetId
        baseParams.promptTemplate = preset?.promptTemplate || ''
        baseParams.lightingCondition = twilightSettings.lightingCondition
        baseParams.customInstructions = twilightSettings.customInstructions
        baseParams.injectorIds = Array.from(selectedInjectorIds)
        baseParams.guardrailIds = Array.from(selectedGuardrailIds)
        if (twilightSettings.referenceImageId) {
          const refImage = await window.electronAPI.getReferenceImage('twilight', twilightSettings.referenceImageId)
          if (refImage?.imagePath) {
            baseParams.referenceImagePath = refImage.imagePath
          }
        }
      }

      if (activeModule === 'relight') {
        const presets = await window.electronAPI.getRelightPresets()
        const preset = presets.find((p: any) => p.id === relightSettings.presetId)
        baseParams.presetId = relightSettings.presetId
        baseParams.promptTemplate = preset?.promptTemplate || ''
        baseParams.customInstructions = relightSettings.customInstructions
        baseParams.injectorIds = Array.from(selectedInjectorIds)
        baseParams.guardrailIds = Array.from(selectedGuardrailIds)
        if (relightSettings.referenceImageId) {
          const refImage = await window.electronAPI.getReferenceImage('relight', relightSettings.referenceImageId)
          if (refImage?.imagePath) {
            baseParams.referenceImagePath = refImage.imagePath
          }
        }
      }

      if (activeModule === 'stage') {
        baseParams.roomType = stagingSettings.roomType
        baseParams.style = stagingSettings.style
        baseParams.roomDimensions = stagingSettings.roomDimensions
        baseParams.injectorIds = Array.from(selectedInjectorIds)
        baseParams.guardrailIds = Array.from(selectedGuardrailIds)
      }

      if (activeModule === 'renovate') {
        baseParams.changes = renovateSettings.changes
        baseParams.injectorIds = Array.from(selectedInjectorIds)
        baseParams.guardrailIds = Array.from(selectedGuardrailIds)
      }

      if (activeModule === 'clean') {
        baseParams.injectorIds = Array.from(selectedInjectorIds)
        baseParams.guardrailIds = Array.from(selectedGuardrailIds)
      }

      if (activeModule === 'freeform') {
        baseParams.craftedPrompt = freeformSettings.craftedPrompt
        baseParams.injectorIds = Array.from(selectedInjectorIds)
        baseParams.guardrailIds = Array.from(selectedGuardrailIds)
        baseParams.customInstructions = freeformSettings.customInstructions
      }

      const results = await window.api.invoke(`module:${activeModule}:batchGenerate`, baseParams)

      const { createdVersionIdsByAssetId, failedAssetIds } = getBatchRunMappingFromResults(results)

      // Immediate MainStage trust fix:
      // - set viewedVersionIdByAssetId for every selected asset
      // - insert a pending version shell so contact tiles can show progress immediately
      for (const assetId of assetIds) {
        const createdId = createdVersionIdsByAssetId[assetId]
        if (!createdId) continue
        const sourceId = sourceVersionIdByAssetId[assetId]
        const sourceVersionIds = sourceId ? [sourceId] : []
        const pending = useJobStore.getState().createOptimisticPendingVersion({
          jobId: currentJob.id,
          assetId,
          versionId: createdId,
          module: activeModule,
          sourceVersionIds
        })
        useJobStore.getState().upsertVersionForAsset(assetId, pending)
        setViewedVersionId(assetId, createdId)
      }

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

  const handleApplyHQToSelected = async () => {
    if (!currentJob || !activeModule || selectedAssetIds.size === 0) {
      addToast('Select images first', 'error')
      return
    }

    setIsGenerating(true)
    try {
      const assetIds = Array.from(selectedAssetIds)

      // Determine per-asset source version mapping
      const sourceVersionIdByAssetId: Record<string, string> = {}
      if (assetIds.length === 1) {
        const assetId = assetIds[0]
        const viewed = getViewedVersionId(assetId)
        if (viewed) {
          sourceVersionIdByAssetId[assetId] = viewed
        } else {
          if (activeModule === 'stage' || activeModule === 'renovate') {
            sourceVersionIdByAssetId[assetId] = `original:${assetId}`
          }
        }
      } else {
        for (const assetId of assetIds) {
          await loadVersionsForAsset(currentJob.id, assetId)
          if (activeModule === 'stage' || activeModule === 'renovate') {
            // For staging/renovate: source should be empty-room input.
            // Prefer latest ready clean-slate output, else fall back to original.
            const versions = useJobStore.getState().versionsByAssetId[assetId] || []
            const cleanSlateVersion = versions
              .filter(v => v.module === 'clean' && (v.status === 'hq_ready' || v.status === 'approved' || v.status === 'final_ready'))
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

            if (cleanSlateVersion?.id) {
              sourceVersionIdByAssetId[assetId] = cleanSlateVersion.id
            } else {
              sourceVersionIdByAssetId[assetId] = `original:${assetId}`
            }
          } else {
            const latest = getAssetLatestVersion(assetId)
            if (latest?.id) {
              sourceVersionIdByAssetId[assetId] = latest.id
            }
          }
        }
      }
      
      const baseParams: any = {
        jobId: currentJob.id,
        assetIds,
        sourceVersionIdByAssetId,
        qualityTier: 'hq_preview'  // Signal HQ preview generation
      }

      if (activeModule === 'twilight') {
        const presets = await window.electronAPI.getPresets()
        const preset = presets.find((p: any) => p.id === twilightSettings.presetId)
        baseParams.presetId = twilightSettings.presetId
        baseParams.promptTemplate = preset?.promptTemplate || ''
        baseParams.lightingCondition = twilightSettings.lightingCondition
        baseParams.customInstructions = twilightSettings.customInstructions
        baseParams.injectorIds = Array.from(selectedInjectorIds)
        baseParams.guardrailIds = Array.from(selectedGuardrailIds)
        if (twilightSettings.referenceImageId) {
          const refImage = await window.electronAPI.getReferenceImage('twilight', twilightSettings.referenceImageId)
          if (refImage?.imagePath) {
            baseParams.referenceImagePath = refImage.imagePath
          }
        }
      }

      if (activeModule === 'relight') {
        const presets = await window.electronAPI.getRelightPresets()
        const preset = presets.find((p: any) => p.id === relightSettings.presetId)
        baseParams.presetId = relightSettings.presetId
        baseParams.promptTemplate = preset?.promptTemplate || ''
        baseParams.customInstructions = relightSettings.customInstructions
        baseParams.injectorIds = Array.from(selectedInjectorIds)
        baseParams.guardrailIds = Array.from(selectedGuardrailIds)
        if (relightSettings.referenceImageId) {
          const refImage = await window.electronAPI.getReferenceImage('relight', relightSettings.referenceImageId)
          if (refImage?.imagePath) {
            baseParams.referenceImagePath = refImage.imagePath
          }
        }
      }

      if (activeModule === 'stage') {
        baseParams.roomType = stagingSettings.roomType
        baseParams.style = stagingSettings.style
        baseParams.roomDimensions = stagingSettings.roomDimensions
        baseParams.injectorIds = Array.from(selectedInjectorIds)
        baseParams.guardrailIds = Array.from(selectedGuardrailIds)
        baseParams.enableSceneMode = stagingSettings.enableSceneMode
        baseParams.isMasterView = stagingSettings.isMasterView
      }

      if (activeModule === 'renovate') {
        baseParams.changes = renovateSettings.changes
        baseParams.injectorIds = Array.from(selectedInjectorIds)
        baseParams.guardrailIds = Array.from(selectedGuardrailIds)
      }

      if (activeModule === 'clean') {
        baseParams.injectorIds = Array.from(selectedInjectorIds)
        baseParams.guardrailIds = Array.from(selectedGuardrailIds)
      }

      if (activeModule === 'freeform') {
        baseParams.craftedPrompt = freeformSettings.craftedPrompt
        baseParams.injectorIds = Array.from(selectedInjectorIds)
        baseParams.guardrailIds = Array.from(selectedGuardrailIds)
        baseParams.customInstructions = freeformSettings.customInstructions
      }

      const results = await window.api.invoke(`module:${activeModule}:batchGenerateHQ`, baseParams)

      const { createdVersionIdsByAssetId, failedAssetIds } = getBatchRunMappingFromResults(results)

      for (const assetId of assetIds) {
        const createdId = createdVersionIdsByAssetId[assetId]
        if (!createdId) continue
        const sourceId = sourceVersionIdByAssetId[assetId]
        const sourceVersionIds = sourceId ? [sourceId] : []
        const pending = useJobStore.getState().createOptimisticPendingVersion({
          jobId: currentJob.id,
          assetId,
          versionId: createdId,
          module: activeModule,
          sourceVersionIds
        })
        useJobStore.getState().upsertVersionForAsset(assetId, pending)
        setViewedVersionId(assetId, createdId)
      }

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

      addToast(`Started HQ ${activeModule} generation for ${assetIds.length} images`, 'success')
    } catch (error) {
      console.error('HQ Batch generation failed:', error)
      addToast('Failed to start HQ generation', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApplyNative4KToSelected = async () => {
    if (!currentJob || !activeModule || selectedAssetIds.size === 0) {
      addToast('Select images first', 'error')
      return
    }

    setIsGenerating(true)
    try {
      const assetIds = Array.from(selectedAssetIds)

      // Determine per-asset source version mapping
      const sourceVersionIdByAssetId: Record<string, string> = {}
      if (assetIds.length === 1) {
        const assetId = assetIds[0]
        const viewed = getViewedVersionId(assetId)
        if (viewed) {
          sourceVersionIdByAssetId[assetId] = viewed
        } else {
          if (activeModule === 'stage' || activeModule === 'renovate') {
            sourceVersionIdByAssetId[assetId] = `original:${assetId}`
          }
        }
      } else {
        for (const assetId of assetIds) {
          await loadVersionsForAsset(currentJob.id, assetId)
          if (activeModule === 'stage' || activeModule === 'renovate') {
            // For staging/renovate: source should be empty-room input.
            // Prefer latest ready clean-slate output, else fall back to original.
            const versions = useJobStore.getState().versionsByAssetId[assetId] || []
            const cleanSlateVersion = versions
              .filter(v => v.module === 'clean' && (v.status === 'hq_ready' || v.status === 'approved' || v.status === 'final_ready'))
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

            if (cleanSlateVersion?.id) {
              sourceVersionIdByAssetId[assetId] = cleanSlateVersion.id
            } else {
              sourceVersionIdByAssetId[assetId] = `original:${assetId}`
            }
          } else {
            const latest = getAssetLatestVersion(assetId)
            if (latest?.id) {
              sourceVersionIdByAssetId[assetId] = latest.id
            }
          }
        }
      }

      const baseParams: any = {
        jobId: currentJob.id,
        assetIds,
        sourceVersionIdByAssetId,
        qualityTier: 'native_4k'  // Signal Native 4K generation
      }

      if (activeModule === 'twilight') {
        const presets = await window.electronAPI.getPresets()
        const preset = presets.find((p: any) => p.id === twilightSettings.presetId)
        baseParams.presetId = twilightSettings.presetId
        baseParams.promptTemplate = preset?.promptTemplate || ''
        baseParams.lightingCondition = twilightSettings.lightingCondition
        baseParams.customInstructions = twilightSettings.customInstructions
        baseParams.injectorIds = Array.from(selectedInjectorIds)
        baseParams.guardrailIds = Array.from(selectedGuardrailIds)
        if (twilightSettings.referenceImageId) {
          const refImage = await window.electronAPI.getReferenceImage('twilight', twilightSettings.referenceImageId)
          if (refImage?.imagePath) {
            baseParams.referenceImagePath = refImage.imagePath
          }
        }
      }

      if (activeModule === 'relight') {
        const presets = await window.electronAPI.getRelightPresets()
        const preset = presets.find((p: any) => p.id === relightSettings.presetId)
        baseParams.presetId = relightSettings.presetId
        baseParams.promptTemplate = preset?.promptTemplate || ''
        baseParams.customInstructions = relightSettings.customInstructions
        baseParams.injectorIds = Array.from(selectedInjectorIds)
        baseParams.guardrailIds = Array.from(selectedGuardrailIds)
        if (relightSettings.referenceImageId) {
          const refImage = await window.electronAPI.getReferenceImage('relight', relightSettings.referenceImageId)
          if (refImage?.imagePath) {
            baseParams.referenceImagePath = refImage.imagePath
          }
        }
      }

      if (activeModule === 'stage') {
        baseParams.roomType = stagingSettings.roomType
        baseParams.style = stagingSettings.style
        baseParams.roomDimensions = stagingSettings.roomDimensions
        baseParams.injectorIds = Array.from(selectedInjectorIds)
        baseParams.guardrailIds = Array.from(selectedGuardrailIds)
        baseParams.enableSceneMode = stagingSettings.enableSceneMode
        baseParams.isMasterView = stagingSettings.isMasterView
      }

      if (activeModule === 'renovate') {
        baseParams.changes = renovateSettings.changes
        baseParams.injectorIds = Array.from(selectedInjectorIds)
        baseParams.guardrailIds = Array.from(selectedGuardrailIds)
      }

      if (activeModule === 'clean') {
        baseParams.injectorIds = Array.from(selectedInjectorIds)
        baseParams.guardrailIds = Array.from(selectedGuardrailIds)
      }

      if (activeModule === 'freeform') {
        baseParams.craftedPrompt = freeformSettings.craftedPrompt
        baseParams.injectorIds = Array.from(selectedInjectorIds)
        baseParams.guardrailIds = Array.from(selectedGuardrailIds)
        baseParams.customInstructions = freeformSettings.customInstructions
      }

      const results = await window.api.invoke(`module:${activeModule}:batchGenerateNative4K`, baseParams)

      const { createdVersionIdsByAssetId, failedAssetIds } = getBatchRunMappingFromResults(results)

      for (const assetId of assetIds) {
        const createdId = createdVersionIdsByAssetId[assetId]
        if (!createdId) continue
        const sourceId = sourceVersionIdByAssetId[assetId]
        const sourceVersionIds = sourceId ? [sourceId] : []
        const pending = useJobStore.getState().createOptimisticPendingVersion({
          jobId: currentJob.id,
          assetId,
          versionId: createdId,
          module: activeModule,
          sourceVersionIds
        })
        useJobStore.getState().upsertVersionForAsset(assetId, pending)
        setViewedVersionId(assetId, createdId)
      }

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

      addToast(`Started Native 4K ${activeModule} generation for ${assetIds.length} images`, 'success')
    } catch (error) {
      console.error('Native 4K Batch generation failed:', error)
      addToast('Failed to start Native 4K generation', 'error')
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
          onClick={() => setBatchExportOpen(true)}
          disabled={exportableVersionIds.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-300"
          title={`Export ${exportableVersionIds.length} images`}
        >
          <Download className="w-4 h-4" />
          Export ({exportableVersionIds.length})
        </button>

        <button
          onClick={handleShowJobInFinder}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          title="Show job folder in Finder"
        >
          <FolderOpen className="w-5 h-5 text-slate-400" />
        </button>

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
            <SourcePreviewPanel selectedAssetIds={Array.from(selectedAssetIds)} />
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
            onApplyHQ={handleApplyHQToSelected}
            onApplyNative4K={handleApplyNative4KToSelected}
          />
        }
      />

      <BatchExportDialog
        open={batchExportOpen}
        onClose={() => setBatchExportOpen(false)}
        jobId={currentJob.id}
        versionIds={exportableVersionIds}
      />
    </div>
  )
}
