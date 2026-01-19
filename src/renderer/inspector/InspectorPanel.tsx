import React, { useEffect, useMemo, useState } from 'react'
import type { Asset, ModuleType } from '../../shared/types'
import { CostEstimateDisplay, SingleGenerationCostBadge } from '../components/CostEstimateDisplay'
import { TwilightSettings } from '../components/modules/settings/TwilightSettings'
import { CleanSlateSettings } from '../components/modules/settings/CleanSlateSettings'
import { StagingSettings } from '../components/modules/settings/StagingSettings'
import { RenovateSettings } from '../components/modules/settings/RenovateSettings'
import { resolveGenerationStatus } from '../../shared/resolveGenerationStatus'
import { useInspectorTruth } from './useInspectorTruth'
import { useJobStore } from '../store/useJobStore'
import { BatchRunSummarySection } from './BatchRunSummarySection'
import { useAppStore } from '../store/useAppStore'

export interface InspectorPanelProps {
  activeModule: ModuleType | null
  selectedAssetIds: string[]
  assets: Asset[]
  applyTargetLabel?: string
  onApply: () => void
  onApplyHQ?: () => void
  isApplyingDisabled?: boolean
}

export async function retryViewedVersionFromInspector(params: {
  jobId: string
  assetId: string
  versionId: string
  invoke: (channel: string, ...args: any[]) => Promise<any>
  setViewedVersionId: (assetId: string, versionId: string | null) => void
  setLastAppliedVersionId: (assetId: string, versionId: string | null) => void
}): Promise<string | null> {
  const created = await params.invoke('version:retry', { jobId: params.jobId, versionId: params.versionId })
  const newId = created?.id
  if (typeof newId !== 'string' || newId.length === 0) return null
  params.setLastAppliedVersionId(params.assetId, newId)
  params.setViewedVersionId(params.assetId, newId)
  return newId
}

export function shouldShowInspectorRetry(params: {
  selectionCount: number
  currentJobId: string | null
  viewedVersion: { generationStatus?: any; status?: any } | null
}): boolean {
  return (
    params.selectionCount === 1 &&
    !!params.currentJobId &&
    !!params.viewedVersion &&
    resolveGenerationStatus(params.viewedVersion as any) === 'failed'
  )
}

export function InspectorPanel(props: InspectorPanelProps) {
  const selectionCount = props.selectedAssetIds.length
  const [isPromptExpanded, setIsPromptExpanded] = useState(false)

  const {
    currentJob,
    getAssetVersions,
    getViewedVersionId,
    setViewedVersionId,
    setLastAppliedVersionId,
    loadVersionsForAsset,
    approveVersion,
    unapproveVersion,
    activeBatchRun,
    versionsByAssetId,
    dismissBatchRun,
    jumpToBatchAsset,
    jumpToNextFailedInBatchRun,
    jumpToNextPendingInBatchRun,
    jumpToNextCompletedInBatchRun,
    loadAssetsForJob
  } = useJobStore()

  const { addToast } = useAppStore()

  const viewedVersion = useMemo(() => {
    if (selectionCount !== 1) return null
    const assetId = props.selectedAssetIds[0]
    const viewedId = getViewedVersionId(assetId)
    if (!viewedId) return null
    const versions = getAssetVersions(assetId)
    return versions.find((x) => x.id === viewedId) || null
  }, [selectionCount, props.selectedAssetIds, getViewedVersionId, getAssetVersions])

  const generationError = useMemo(() => {
    if (!viewedVersion) return null
    const failed = resolveGenerationStatus(viewedVersion) === 'failed'
    if (!failed) return null
    return viewedVersion.generationError || viewedVersion.error || 'Generation failed'
  }, [viewedVersion])

  const canRetry = shouldShowInspectorRetry({
    selectionCount,
    currentJobId: currentJob?.id ?? null,
    viewedVersion
  })

  const canApproveViewed = !!(currentJob && viewedVersion && selectionCount === 1)
  const canGenerateFinalViewed = !!(
    currentJob &&
    viewedVersion &&
    selectionCount === 1 &&
    (viewedVersion.status === 'approved' || viewedVersion.status === 'hq_ready')
  )

  const canRegenerateHqViewed = !!(
    currentJob &&
    viewedVersion &&
    selectionCount === 1 &&
    viewedVersion.status === 'approved'
  )

  const canGenerateNative4K = !!(
    currentJob &&
    viewedVersion &&
    selectionCount === 1 &&
    viewedVersion.status === 'approved'
  )

  const selectionSummary = useMemo(() => {
    if (selectionCount === 0) return 'Selected: 0'
    if (selectionCount === 1) {
      const asset = props.assets.find((a) => a.id === props.selectedAssetIds[0])
      const name = asset?.displayName || asset?.name || props.selectedAssetIds[0]
      return `Selected: 1 — ${name}`
    }
    return `Selected: ${selectionCount} — ${selectionCount} selected`
  }, [selectionCount, props.assets, props.selectedAssetIds])

  const truth = useInspectorTruth({
    enabled: !!props.activeModule,
    moduleType: props.activeModule || 'clean',
    selectionCount
  })

  const applyLabel = `Apply to Selected (${selectionCount})`
  const isApplyDisabled = (props.isApplyingDisabled ?? false) || selectionCount === 0 || !props.activeModule

  const handleApproveViewed = async () => {
    if (!currentJob || !viewedVersion || selectionCount !== 1) return
    try {
      if (viewedVersion.status === 'approved') {
        await unapproveVersion(currentJob.id, viewedVersion.id)
        addToast('Version unapproved', 'success')
      } else {
        await approveVersion(currentJob.id, viewedVersion.id)
        addToast('Version approved', 'success')
      }
      await loadVersionsForAsset(currentJob.id, props.selectedAssetIds[0])
    } catch (error) {
      addToast('Failed to update approval', 'error')
    }
  }

  const handleGenerateFinalViewed = async () => {
    if (!currentJob || !viewedVersion || selectionCount !== 1) return
    try {
      await window.api.invoke('version:generateFinal', currentJob.id, viewedVersion.id)
      addToast('Final generation started', 'success')
      await loadVersionsForAsset(currentJob.id, props.selectedAssetIds[0])
    } catch (error) {
      addToast('Failed to start final generation', 'error')
    }
  }

  const handleRegenerateHqViewed = async () => {
    if (!currentJob || !viewedVersion || selectionCount !== 1) return
    try {
      await window.api.invoke('version:regenerateHQ', currentJob.id, viewedVersion.id)
      addToast('Regenerate (HQ) started', 'success')
      await loadVersionsForAsset(currentJob.id, props.selectedAssetIds[0])
    } catch (error) {
      addToast('Failed to start HQ regenerate', 'error')
    }
  }

  const handleGenerateNative4K = async () => {
    if (!currentJob || !viewedVersion || selectionCount !== 1) return
    try {
      await window.api.invoke('version:generateNative4K', currentJob.id, viewedVersion.id)
      addToast('Native 4K generation started', 'success')
      await loadVersionsForAsset(currentJob.id, props.selectedAssetIds[0])
    } catch (error) {
      addToast('Failed to start Native 4K generation', 'error')
    }
  }

  const handleUseAsSource = async () => {
    if (!currentJob || !viewedVersion || selectionCount !== 1) return
    try {
      await window.api.invoke('asset:setWorkingSource', {
        jobId: currentJob.id,
        assetId: props.selectedAssetIds[0],
        versionId: viewedVersion.id
      })
      await loadAssetsForJob(currentJob.id)
      addToast('Set as working source for other modules', 'success')
    } catch (error) {
      addToast('Failed to set working source', 'error')
    }
  }

  const handleClearWorkingSource = async () => {
    if (!currentJob || selectionCount !== 1) return
    try {
      await window.api.invoke('asset:setWorkingSource', {
        jobId: currentJob.id,
        assetId: props.selectedAssetIds[0],
        versionId: null
      })
      await loadAssetsForJob(currentJob.id)
      addToast('Reverted to original source', 'success')
    } catch (error) {
      addToast('Failed to clear working source', 'error')
    }
  }

  // Check if viewed version has output and can be used as source
  const canUseAsSource = !!(
    currentJob &&
    viewedVersion &&
    selectionCount === 1 &&
    viewedVersion.outputPath
  )

  useEffect(() => {
    if (!activeBatchRun || activeBatchRun.dismissed) return

    const isEditableElement = (el: any): boolean => {
      if (!el) return false
      const tag = typeof el.tagName === 'string' ? (el.tagName as string).toLowerCase() : ''
      if (tag === 'input' || tag === 'textarea') return true
      if (el.isContentEditable) return true
      const attr = typeof el.getAttribute === 'function' ? el.getAttribute('contenteditable') : null
      if (attr === '' || attr === 'true') return true
      const prop = typeof el.contentEditable === 'string' ? el.contentEditable : null
      if (prop === 'true') return true
      return false
    }

    const shouldIgnoreKeydownTarget = (e: KeyboardEvent): boolean => {
      const anyE = e as any
      const path: any[] = typeof anyE.composedPath === 'function' ? anyE.composedPath() : []
      for (const node of path) {
        if (isEditableElement(node)) return true
      }

      let el: any = e.target as any
      while (el) {
        if (isEditableElement(el)) return true
        el = el.parentElement
      }

      return false
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreKeydownTarget(e)) return
      if (e.key === ']') jumpToNextFailedInBatchRun()
      if (e.key === '[') jumpToNextPendingInBatchRun()
      if (e.key === '\\') jumpToNextCompletedInBatchRun()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    activeBatchRun,
    jumpToNextFailedInBatchRun,
    jumpToNextPendingInBatchRun,
    jumpToNextCompletedInBatchRun
  ])



  return (
    <aside className="h-full flex flex-col">
      <div data-testid="inspector-header" className="p-4 border-b border-slate-700">
        <div className="text-lg font-semibold text-white">Inspector</div>
      </div>

      <div className={`flex-1 overflow-y-auto scrollbar-thin p-4 ${isPromptExpanded ? 'space-y-2' : 'space-y-4'} min-w-0`}>
        {/* 2) Selection */}
        <section data-testid="section-selection" className="p-4 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 space-y-1 min-w-0">
          <div className="text-[11px] tracking-wide text-slate-200 font-semibold">SELECTION</div>
          <div>{selectionSummary}</div>
          {selectionCount === 0 && (
            <div className="text-slate-500">Select an image in the Library to begin</div>
          )}
        </section>

        <BatchRunSummarySection
          assets={props.assets}
          selectionCount={selectionCount}
          selectedAssetIds={props.selectedAssetIds}
          activeBatchRun={activeBatchRun as any}
          versionsByAssetId={versionsByAssetId as any}
          onDismiss={dismissBatchRun}
          onJumpToAsset={jumpToBatchAsset}
          onNextFailed={jumpToNextFailedInBatchRun}
          onNextPending={jumpToNextPendingInBatchRun}
          onNextCompleted={jumpToNextCompletedInBatchRun}
        />

        {/* 3) Provider Truth */}
        <section data-testid="section-provider" className="p-4 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 space-y-2 min-w-0">
          <div className="text-[11px] tracking-wide text-slate-200 font-semibold">PROVIDER TRUTH</div>
          <div className="flex items-start gap-2 min-w-0" data-testid="provider-row">
            <span className="text-slate-500 w-28 flex-shrink-0">Provider</span>
            <span className="text-white font-medium min-w-0 truncate">{truth.providerDisplay || '...'}</span>
          </div>
          <div className="flex items-start gap-2 min-w-0" data-testid="provider-row">
            <span className="text-slate-500 w-28 flex-shrink-0">Model</span>
            <span className="text-white font-mono min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{truth.resolvedProvider.model || '...'}</span>
          </div>
          <div className="flex items-start gap-2 min-w-0" data-testid="provider-row">
            <span className="text-slate-500 w-28 flex-shrink-0">Endpoint</span>
            <span className="text-white font-mono min-w-0 break-words overflow-hidden">{truth.resolvedProvider.endpointBaseUrl || '...'}</span>
          </div>
          {truth.resolvedProvider.resolvedBy === 'env_override' && truth.resolvedProvider.envOverride && (
            <div className="text-amber-300">
              Overridden by env: {truth.resolvedProvider.envOverride.key}={truth.resolvedProvider.envOverride.value}
            </div>
          )}
        </section>

        {generationError && (
          <section data-testid="section-generation-error" className="p-4 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 space-y-2 min-w-0">
            <div className="text-[11px] tracking-wide text-slate-200 font-semibold">GENERATION ERROR</div>
            <div className="text-slate-200 break-words">{generationError}</div>
            {canRetry && (
              <button
                type="button"
                data-testid="inspector-retry"
                onClick={() => {
                  const api = (globalThis as any)?.window?.api as { invoke?: (channel: string, ...args: any[]) => Promise<any> } | undefined
                  const invoke = api?.invoke
                  const assetId = props.selectedAssetIds[0]
                  if (!invoke || !currentJob || !viewedVersion) return
                  retryViewedVersionFromInspector({
                    jobId: currentJob.id,
                    assetId,
                    versionId: viewedVersion.id,
                    invoke,
                    setViewedVersionId,
                    setLastAppliedVersionId
                  }).catch(() => undefined)
                }}
                className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded"
              >
                Retry
              </button>
            )}
          </section>
        )}

        {/* 4) Prompt Truth */}
        <section
          data-testid="section-prompt"
          className={`p-4 bg-slate-900 border border-slate-700 rounded-lg space-y-2 min-w-0 ${isPromptExpanded ? 'flex flex-col min-h-[22rem]' : ''}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] tracking-wide text-slate-200 font-semibold">PROMPT TRUTH</div>
            <button
              type="button"
              onClick={() => setIsPromptExpanded((v) => !v)}
              className="text-[11px] text-slate-400 hover:text-white transition-colors"
            >
              {isPromptExpanded ? 'Restore' : 'Maximize'}
            </button>
          </div>
          <div className="text-xs text-slate-300">
            <span className="text-slate-500">promptHash:</span>{' '}
            <span className="text-white font-mono">{truth.promptHash || '...'}</span>
          </div>
          <div className={`space-y-2 ${isPromptExpanded ? 'flex-1 flex flex-col min-h-0' : ''}`}>
            <label className="block text-sm font-medium text-slate-300">Final Prompt (Live)</label>
            <textarea
              value={truth.fullPrompt || ''}
              readOnly
              className={`w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg font-mono text-xs text-slate-300 resize-y focus:outline-none ${
                isPromptExpanded ? 'flex-1 min-h-[16rem] max-h-[9999px]' : 'h-64 min-h-[14rem] max-h-[32rem]'
              }`}
            />

            <label className="block text-sm font-medium text-slate-300">Prompt Used (Stored on Version)</label>
            <textarea
              value={((viewedVersion?.recipe?.settings as any)?.fullPrompt as string | undefined) || ''}
              readOnly
              placeholder={viewedVersion ? 'No stored prompt found on this version.' : 'Select a generated version to see the exact stored prompt used.'}
              className={`w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg font-mono text-xs text-slate-300 resize-y focus:outline-none ${
                isPromptExpanded ? 'flex-1 min-h-[16rem] max-h-[9999px]' : 'h-64 min-h-[14rem] max-h-[32rem]'
              }`}
            />
          </div>
        </section>

        {/* 5) Extra Instructions */}
        <section data-testid="section-extra" className="p-4 bg-slate-900 border border-slate-700 rounded-lg space-y-2 min-w-0">
          <div className="text-[11px] tracking-wide text-slate-200 font-semibold">EXTRA INSTRUCTIONS</div>
          <textarea
            value={truth.extraInstructions || ''}
            onChange={(e) => truth.setExtraInstructions(e.target.value)}
            placeholder="Additional instructions appended to the prompt"
            className="w-full h-24 min-h-[5rem] max-h-[16rem] px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 resize-y focus:outline-none focus:border-blue-500"
          />
        </section>

        {/* 6) Module Controls */}
        <section data-testid="section-module" className="p-4 bg-slate-900 border border-slate-700 rounded-lg space-y-3 min-w-0">
          <div className="text-[11px] tracking-wide text-slate-200 font-semibold">MODULE SETTINGS</div>
          {!props.activeModule ? (
            <div className="text-xs text-slate-500">Select a module to edit how the selection is processed</div>
          ) : (
            <div>
              {props.activeModule === 'twilight' && <TwilightSettings />}
              {props.activeModule === 'clean' && <CleanSlateSettings />}
              {props.activeModule === 'stage' && <StagingSettings />}
              {props.activeModule === 'renovate' && <RenovateSettings />}
            </div>
          )}
        </section>

        {/* 7) Cost Reference */}
        <section data-testid="section-cost" className="p-4 bg-slate-900 border border-slate-700 rounded-lg space-y-2 min-w-0">
          <div className="text-[11px] tracking-wide text-slate-200 font-semibold">COST REFERENCE</div>
          <CostEstimateDisplay 
            showPerImageCosts={true}
            previewCount={selectionCount > 0 ? selectionCount : 0}
          />
        </section>
      </div>

      {/* 7) Primary Action */}
      <div data-testid="section-primary-action" className="flex-shrink-0 p-4 border-t border-slate-700 bg-slate-800/80">
        {props.applyTargetLabel && (
          <div className="text-xs text-slate-400 mb-2" data-testid="apply-target-label">
            {props.applyTargetLabel}
          </div>
        )}

        {/* Generation Buttons - Preview and HQ Preview */}
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={props.onApply}
            disabled={isApplyDisabled}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg transition-colors"
            title="Generate quick preview (~$0.04/image)"
          >
            <div className="text-sm font-medium">Preview</div>
            <div className="text-xs text-blue-200">~$0.04</div>
          </button>

          <button
            type="button"
            onClick={props.onApplyHQ}
            disabled={isApplyDisabled || !props.onApplyHQ}
            className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg transition-colors"
            title="Generate HQ preview with Nano Banana Pro 2K (~$0.13/image) - preview what 4K will look like"
          >
            <div className="text-sm font-medium">HQ Preview (2K)</div>
            <div className="text-xs text-purple-200">~$0.13</div>
          </button>
        </div>

        {/* Version Actions - Approve, 4K, Use as Source */}
        {selectionCount === 1 && currentJob && viewedVersion && (
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={handleApproveViewed}
              disabled={!canApproveViewed}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                viewedVersion.status === 'approved'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-700 hover:bg-emerald-600 text-slate-200 hover:text-white'
              }`}
            >
              {viewedVersion.status === 'approved' ? 'Unapprove' : 'Approve'}
            </button>

            {canGenerateNative4K && (
              <button
                type="button"
                onClick={handleGenerateNative4K}
                className="flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors bg-amber-600 hover:bg-amber-700 text-white"
                title="Generate true 4K version (3840×2160) using native model resolution"
              >
                <div className="text-sm font-medium">Generate 4K</div>
                <div className="text-xs text-amber-200">~$0.24</div>
              </button>
            )}
          </div>
        )}

        {canUseAsSource && (
          <div className="mb-3">
            <button
              type="button"
              onClick={handleUseAsSource}
              className="w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors bg-teal-600 hover:bg-teal-700 text-white"
              title="Use this version's output as the base image for other modules (e.g., use decluttered 4K for staging)"
            >
              Use as Source for Other Modules
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
