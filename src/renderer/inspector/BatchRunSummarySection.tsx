import React, { useEffect, useRef, useState } from 'react'
import type { Asset } from '../../shared/types'
import { resolveGenerationStatus } from '../../shared/resolveGenerationStatus'
import { getBatchRunCounts, getNextBatchAssetIdByPredicate } from '../store/useJobStore'

export function BatchRunSummarySection(props: {
  assets: Asset[]
  selectionCount: number
  selectedAssetIds: string[]
  activeBatchRun: any
  versionsByAssetId: Record<string, any[]>
  onDismiss: () => void
  onJumpToAsset: (assetId: string) => void
  onNextFailed: () => void
  onNextPending: () => void
  onNextCompleted: () => void
  pendingInitiallyExpanded?: boolean
}): JSX.Element | null {
  const activeBatchRun = props.activeBatchRun
  const [isPendingExpanded, setIsPendingExpanded] = useState(!!props.pendingInitiallyExpanded)
  const prevBatchRunIdRef = useRef<string | null>(null)
  const prevDismissedRef = useRef<boolean>(false)

  useEffect(() => {
    const currentId = typeof activeBatchRun?.id === 'string' ? (activeBatchRun.id as string) : null
    const currentDismissed = !!activeBatchRun?.dismissed

    const prevId = prevBatchRunIdRef.current
    const prevDismissed = prevDismissedRef.current

    const runReplaced = prevId !== null && currentId !== null && prevId !== currentId
    const runDismissedNow = !prevDismissed && currentDismissed

    if (runReplaced || runDismissedNow) {
      setIsPendingExpanded(false)
    }

    prevBatchRunIdRef.current = currentId
    prevDismissedRef.current = currentDismissed
  }, [activeBatchRun])

  if (!activeBatchRun || activeBatchRun.dismissed) return null

  const labels: Record<string, string> = {
    twilight: 'Twilight',
    clean: 'Clean Slate',
    stage: 'Staging',
    renovate: 'Renovate'
  }

  const batchRunTitle = labels[activeBatchRun.moduleId] || activeBatchRun.moduleId

  const batchRunTimestampLabel = (() => {
    const deltaMs = Date.now() - activeBatchRun.startedAt
    const seconds = Math.max(0, Math.floor(deltaMs / 1000))
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  })()

  const counts = getBatchRunCounts({ batchRun: activeBatchRun, versionsByAssetId: props.versionsByAssetId as any })

  const currentFocusedAssetId = props.selectionCount === 1 ? props.selectedAssetIds[0] : null
  const nextFailedAssetId = getNextBatchAssetIdByPredicate({
    batchRun: activeBatchRun,
    versionsByAssetId: props.versionsByAssetId as any,
    currentAssetId: currentFocusedAssetId,
    predicate: (status) => status === 'failed'
  })
  const nextPendingAssetId = getNextBatchAssetIdByPredicate({
    batchRun: activeBatchRun,
    versionsByAssetId: props.versionsByAssetId as any,
    currentAssetId: currentFocusedAssetId,
    predicate: (status) => status === 'pending'
  })
  const nextCompletedAssetId = getNextBatchAssetIdByPredicate({
    batchRun: activeBatchRun,
    versionsByAssetId: props.versionsByAssetId as any,
    currentAssetId: currentFocusedAssetId,
    predicate: (status) => status === 'completed'
  })

  const failedAssetIds = (() => {
    const ids: string[] = []
    const failedSet = new Set(activeBatchRun.failedAssetIds || [])
    for (const assetId of activeBatchRun.assetIds) {
      const createdId = activeBatchRun.createdVersionIdsByAssetId[assetId]
      if (!createdId) {
        if (failedSet.has(assetId)) ids.push(assetId)
        continue
      }
      const versions = (props.versionsByAssetId as any)[assetId] || []
      const v = versions.find((x: any) => x.id === createdId)
      if (resolveGenerationStatus(v) === 'failed') ids.push(assetId)
    }
    return ids
  })()

  const pendingAssetIds = (() => {
    const ids: string[] = []
    const failedSet = new Set(activeBatchRun.failedAssetIds || [])
    for (const assetId of activeBatchRun.assetIds) {
      const createdId = activeBatchRun.createdVersionIdsByAssetId[assetId]
      if (!createdId) {
        if (!failedSet.has(assetId)) ids.push(assetId)
        continue
      }
      const versions = (props.versionsByAssetId as any)[assetId] || []
      const v = versions.find((x: any) => x.id === createdId)
      if (resolveGenerationStatus(v) === 'pending') ids.push(assetId)
    }
    return ids
  })()

  const renderThumbnailLiteRow = (assetId: string) => {
    const asset = props.assets.find((a) => a.id === assetId)
    const label = asset?.displayName || asset?.name || assetId
    const idx = activeBatchRun.assetIds.indexOf(assetId)
    const ordinal = (idx >= 0 ? idx : 0) + 1
    return (
      <div key={assetId} className="flex items-center justify-between gap-2">
        <div className="min-w-0 truncate flex items-center gap-2">
          <span data-testid="batch-run-chip" className="w-4 h-4 rounded border border-slate-600 bg-slate-800 flex-shrink-0" />
          <span data-testid="batch-run-ordinal" className="text-slate-400 flex-shrink-0">#{ordinal}</span>
          <span className="min-w-0 truncate">{label}</span>
        </div>
        <button
          type="button"
          data-testid={`batch-run-jump-${assetId}`}
          onClick={() => props.onJumpToAsset(assetId)}
          className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded flex-shrink-0"
        >
          Jump
        </button>
      </div>
    )
  }

  return (
    <section data-testid="section-batch-run" className="p-4 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 space-y-2 min-w-0">
      <div className="text-[11px] tracking-wide text-slate-200 font-semibold">BATCH RUN</div>
      <div className="text-white font-medium">Batch Run: {batchRunTitle}</div>
      <div className="text-slate-400">
        Applied to {activeBatchRun.assetIds.length} assets • {batchRunTimestampLabel}
      </div>
      <div className="text-slate-300">
        Pending {counts.pending} • Completed {counts.completed} • Failed {counts.failed}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="batch-run-next-failed"
          disabled={!nextFailedAssetId}
          onClick={props.onNextFailed}
          className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 border border-slate-700 rounded"
        >
          Next Failed
        </button>
        <button
          type="button"
          data-testid="batch-run-next-pending"
          disabled={!nextPendingAssetId}
          onClick={props.onNextPending}
          className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 border border-slate-700 rounded"
        >
          Next Pending
        </button>
        <button
          type="button"
          data-testid="batch-run-next-completed"
          disabled={!nextCompletedAssetId}
          onClick={props.onNextCompleted}
          className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 border border-slate-700 rounded"
        >
          Next Completed
        </button>
      </div>

      {failedAssetIds.length > 0 && (
        <div className="space-y-2">
          <div className="text-slate-200">Failures</div>
          <div className="space-y-1">{failedAssetIds.slice(0, 8).map(renderThumbnailLiteRow)}</div>

          <button
            type="button"
            data-testid="batch-run-jump-first-failed"
            onClick={() => props.onJumpToAsset(failedAssetIds[0])}
            className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded"
          >
            Jump to first failed
          </button>
        </div>
      )}

      {pendingAssetIds.length > 0 && (
        <div className="space-y-1">
          <button
            type="button"
            data-testid="batch-run-pending-toggle"
            onClick={() => setIsPendingExpanded((v) => !v)}
            className="w-full text-left text-slate-200 hover:text-white transition-colors"
          >
            Pending ({pendingAssetIds.length}) {isPendingExpanded ? '▾' : '▸'}
          </button>
          {isPendingExpanded && <div className="space-y-1 pl-1">{pendingAssetIds.slice(0, 24).map(renderThumbnailLiteRow)}</div>}
        </div>
      )}

      <button
        type="button"
        data-testid="batch-run-dismiss"
        onClick={props.onDismiss}
        className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded"
      >
        Dismiss
      </button>
    </section>
  )
}
