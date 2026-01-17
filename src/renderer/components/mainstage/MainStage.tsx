import React, { useEffect, useMemo, useState } from 'react'
import type { Asset, Version } from '../../../shared/types'
import { orderVersionsOldestFirst } from '../../../shared/versionOrdering'
import { resolveGenerationStatus } from '../../../shared/resolveGenerationStatus'
import { useJobStore } from '../../store/useJobStore'
import { AlertCircle, Loader2 } from 'lucide-react'
import { VersionDots, type VersionDotState } from './VersionDots'
import { MainStageTile } from './MainStageTile'

export type MainStageBatchView = 'contact' | 'focused'

export function nextMainStageBatchView(current: MainStageBatchView, key: string): MainStageBatchView {
  if (key === 'n' || key === 'N') {
    return current === 'contact' ? 'focused' : 'contact'
  }
  return current
}

export interface MainStageProps {
  selectedAssetIds: string[]
  assets: Asset[]
}

export function getNextViewedVersionIdForMainStage(params: {
  orderedVersionsOldestFirst: Version[]
  viewedVersionId: string | null
  direction: -1 | 1
}): string | null {
  const ordered = ['original', ...params.orderedVersionsOldestFirst.map((v) => v.id)]
  const currentKey = params.viewedVersionId || 'original'
  const idx = ordered.indexOf(currentKey)
  const next = ordered[idx + params.direction]
  if (!next) return params.viewedVersionId
  return next === 'original' ? null : next
}

export function getNewestGeneratedVersionIdForMainStage(orderedVersionsOldestFirst: Version[]): string | null {
  return orderedVersionsOldestFirst.length > 0 ? orderedVersionsOldestFirst[orderedVersionsOldestFirst.length - 1].id : null
}

export function getCurrentPreferredVersionIdForMainStage(versions: Version[]): string | null {
  const ordered = orderVersionsOldestFirst(versions)
  const approved = ordered.find((v) => v.lifecycleStatus === 'approved')
  if (approved) return approved.id

  const newest = getNewestGeneratedVersionIdForMainStage(ordered)
  return newest
}

export function getActiveVersionIndexForMainStage(params: {
  orderedVersionsOldestFirst: Version[]
  viewedVersionId: string | null
}): number {
  if (!params.viewedVersionId) return 0
  const idx = params.orderedVersionsOldestFirst.findIndex((v) => v.id === params.viewedVersionId)
  return idx >= 0 ? idx + 1 : 0
}

export function getViewingLabelForMainStage(params: {
  orderedVersionsOldestFirst: Version[]
  viewedVersionId: string | null
  viewedVersion: Version | null
}): string {
  const total = 1 + params.orderedVersionsOldestFirst.length
  const activeIndex = getActiveVersionIndexForMainStage({
    orderedVersionsOldestFirst: params.orderedVersionsOldestFirst,
    viewedVersionId: params.viewedVersionId
  })

  if (activeIndex === 0) {
    return 'Viewing: Original'
  }

  const label = `Viewing: Version ${activeIndex + 1} of ${total}`
  const state = resolveGenerationStatus(params.viewedVersion)
  if (state === 'pending') return `${label} (Generating…)`
  if (state === 'failed') return `${label} (Failed)`
  if (params.viewedVersion?.lifecycleStatus === 'approved') return `${label} (Pick)`
  return label
}

export function getDotStateForMainStage(params: {
  index: number
  orderedVersionsOldestFirst: Version[]
}): VersionDotState {
  if (params.index === 0) return 'idle'
  const v = params.orderedVersionsOldestFirst[params.index - 1]
  const status = resolveGenerationStatus(v)
  if (status === 'pending') return 'pending'
  if (status === 'failed') return 'failed'
  if (status === 'completed') return 'completed'
  return 'idle'
}

export function MainStage({ selectedAssetIds, assets }: MainStageProps) {
  const {
    currentJob,
    loadVersionsForAsset,
    getAssetVersions,
    getViewedVersionId,
    setViewedVersionId,
    getLastAppliedVersionId,
    setLastAppliedVersionId,
    approveVersion,
    deleteVersion
  } = useJobStore()

  const selectionCount = selectedAssetIds.length

  const selectedAssets = useMemo(() => {
    if (selectionCount === 0) return []
    const set = new Set(selectedAssetIds)
    return assets.filter((a) => set.has(a.id))
  }, [selectionCount, selectedAssetIds, assets])

  const [batchView, setBatchView] = useState<MainStageBatchView>('contact')
  const [focusedAssetId, setFocusedAssetId] = useState<string | null>(null)

  const singleSelectedAssetId = selectionCount === 1 ? selectedAssetIds[0] : null

  const versionsForSingle = singleSelectedAssetId ? getAssetVersions(singleSelectedAssetId) : []
  const orderedVersionsForSingle = useMemo(() => {
    return orderVersionsOldestFirst(versionsForSingle)
  }, [versionsForSingle])

  const viewedVersionId = singleSelectedAssetId ? getViewedVersionId(singleSelectedAssetId) : null
  const lastAppliedVersionId = singleSelectedAssetId ? getLastAppliedVersionId(singleSelectedAssetId) : null

  const selectedAsset = useMemo(() => {
    if (selectionCount === 1) {
      const id = selectedAssetIds[0]
      return assets.find((a) => a.id === id) || null
    }

    if (selectionCount > 1 && batchView === 'focused') {
      const id = focusedAssetId || selectedAssetIds[0]
      return assets.find((a) => a.id === id) || null
    }

    return null
  }, [selectionCount, selectedAssetIds, assets, batchView, focusedAssetId])

  const viewedVersion = useMemo(() => {
    if (!selectedAsset) return null
    if (!viewedVersionId) return null
    return orderedVersionsForSingle.find((v) => v.id === viewedVersionId) || null
  }, [selectedAsset, viewedVersionId, orderedVersionsForSingle])

  const activeVersionIndex = useMemo(() => {
    return getActiveVersionIndexForMainStage({
      orderedVersionsOldestFirst: orderedVersionsForSingle,
      viewedVersionId
    })
  }, [orderedVersionsForSingle, viewedVersionId])

  const viewingLabel = useMemo(() => {
    if (!selectedAsset) return ''
    return getViewingLabelForMainStage({
      orderedVersionsOldestFirst: orderedVersionsForSingle,
      viewedVersionId,
      viewedVersion
    })
  }, [selectedAsset, orderedVersionsForSingle, viewedVersionId, viewedVersion])

  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [contactThumbs, setContactThumbs] = useState<Record<string, string | null>>({})
  const [versionProgress, setVersionProgress] = useState<Record<string, number>>({})
  const [displayedPixelWidth, setDisplayedPixelWidth] = useState<number | null>(null)
  const [headerInlineMessage, setHeaderInlineMessage] = useState<string | null>(null)

  useEffect(() => {
    if (selectionCount <= 1) {
      setBatchView('contact')
      setFocusedAssetId(null)
      return
    }

    setFocusedAssetId((prev) => {
      if (prev && selectedAssetIds.includes(prev)) return prev
      return selectedAssetIds[0] || null
    })
  }, [selectionCount, selectedAssetIds])

  useEffect(() => {
    if (selectionCount <= 1) return

    const w = (globalThis as any)?.window as any
    if (!w?.addEventListener) return

    const onKeyDown = (e: KeyboardEvent) => {
      setBatchView((current) => nextMainStageBatchView(current, e.key))
    }

    w.addEventListener('keydown', onKeyDown)
    return () => w.removeEventListener('keydown', onKeyDown)
  }, [selectionCount])

  useEffect(() => {
    let cancelled = false
    setDataUrl(null)
    setDisplayedPixelWidth(null)

    if (!selectedAsset) return

    const inputPath = (() => {
      if (selectionCount === 1) {
        if (!viewedVersionId) return selectedAsset.originalPath
        const v = viewedVersion
        if (v?.outputPath) return v.outputPath
        return selectedAsset.originalPath
      }
      return selectedAsset.originalPath
    })()

    const electronAPI = (globalThis as any)?.window?.electronAPI as
      | { readImageAsDataURL: (imagePath: string) => Promise<string | null> }
      | undefined

    if (!electronAPI?.readImageAsDataURL) {
      return
    }

    electronAPI
      .readImageAsDataURL(inputPath)
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null)
      })

    return () => {
      cancelled = true
    }
  }, [selectedAsset?.originalPath, viewedVersionId, viewedVersion?.outputPath, selectionCount])

  useEffect(() => {
    if (!dataUrl) {
      setDisplayedPixelWidth(null)
      return
    }

    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      const w = (img as any).naturalWidth
      if (typeof w === 'number' && Number.isFinite(w) && w > 0) {
        setDisplayedPixelWidth(w)
      } else {
        setDisplayedPixelWidth(null)
      }
    }
    img.onerror = () => {
      if (cancelled) return
      setDisplayedPixelWidth(null)
    }
    img.src = dataUrl

    return () => {
      cancelled = true
    }
  }, [dataUrl])

  useEffect(() => {
    if (!currentJob) return
    if (!singleSelectedAssetId) return

    loadVersionsForAsset(currentJob.id, singleSelectedAssetId).catch(() => undefined)
  }, [currentJob?.id, singleSelectedAssetId])

  useEffect(() => {
    if (!singleSelectedAssetId) return
    // Default viewedVersionId to latest version (if any) when selecting an asset
    const existing = getViewedVersionId(singleSelectedAssetId)
    if (existing !== null) return

    const preferredId = getCurrentPreferredVersionIdForMainStage(versionsForSingle)
    setViewedVersionId(singleSelectedAssetId, preferredId)
  }, [singleSelectedAssetId, orderedVersionsForSingle.length])

  const isViewedApproved = !!viewedVersion && (viewedVersion.lifecycleStatus === 'approved' || viewedVersion.status === 'approved')
  const canDeleteViewedVersion = !!selectedAsset && !!viewedVersionId && !isViewedApproved

  const handleShowOriginal = () => {
    if (!singleSelectedAssetId) return
    setViewedVersionId(singleSelectedAssetId, null)
  }

  const handleShowCurrent = () => {
    if (!singleSelectedAssetId) return
    const preferredId = getCurrentPreferredVersionIdForMainStage(versionsForSingle)
    setViewedVersionId(singleSelectedAssetId, preferredId)
  }

  const handleShowLastApplied = () => {
    if (!singleSelectedAssetId) return
    const latestId = getNewestGeneratedVersionIdForMainStage(orderedVersionsForSingle)
    if (!latestId) return
    setViewedVersionId(singleSelectedAssetId, latestId)
  }

  const handlePrevNext = (direction: -1 | 1) => {
    if (!singleSelectedAssetId) return
    const next = getNextViewedVersionIdForMainStage({
      orderedVersionsOldestFirst: orderedVersionsForSingle,
      viewedVersionId,
      direction
    })
    setViewedVersionId(singleSelectedAssetId, next)
  }

  const handleDeleteViewed = async () => {
    if (!currentJob) return
    if (!singleSelectedAssetId) return
    if (!viewedVersionId) return

    if (isViewedApproved) {
      setHeaderInlineMessage('Approved versions are locked and cannot be deleted.')
      return
    }

    if (!confirm('Delete this version?')) return
    await deleteVersion(currentJob.id, viewedVersionId)
    await loadVersionsForAsset(currentJob.id, singleSelectedAssetId)

    const afterDeleteOrdered = orderVersionsOldestFirst(getAssetVersions(singleSelectedAssetId))
    const latestId = getNewestGeneratedVersionIdForMainStage(afterDeleteOrdered)
    setViewedVersionId(singleSelectedAssetId, latestId)
    if (lastAppliedVersionId === viewedVersionId) {
      setLastAppliedVersionId(singleSelectedAssetId, null)
    }
  }

  useEffect(() => {
    if (selectionCount <= 1) return
    if (batchView !== 'contact') return

    const electronAPI = (globalThis as any)?.window?.electronAPI as
      | { readImageAsDataURL: (imagePath: string) => Promise<string | null> }
      | undefined

    if (!electronAPI?.readImageAsDataURL) return

    let cancelled = false
    const run = async () => {
      const updates: Record<string, string | null> = {}
      for (const asset of selectedAssets) {
        if (cancelled) return
        const viewedId = getViewedVersionId(asset.id)
        const versions = getAssetVersions(asset.id)
        const viewed = viewedId ? versions.find((v) => v.id === viewedId) || null : null
        const inputPath = viewed?.outputPath || asset.originalPath
        try {
          const url = await electronAPI.readImageAsDataURL(inputPath)
          updates[asset.id] = url
        } catch {
          updates[asset.id] = null
        }
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setContactThumbs((prev) => ({ ...prev, ...updates }))
      }
    }

    run().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [selectionCount, batchView, selectedAssets])

  useEffect(() => {
    if (!currentJob) return

    const api = (globalThis as any)?.window?.api as
      | { onVersionProgress?: (cb: (data: { versionId: string; progress: number }) => void) => () => void }
      | undefined

    if (!api?.onVersionProgress) return

    const unsubscribe = api.onVersionProgress((data) => {
      setVersionProgress((prev) => ({ ...prev, [data.versionId]: data.progress }))

      // When the currently running "last applied" version completes, refresh versions and switch viewer
      if (
        data.progress >= 100 &&
        currentJob &&
        singleSelectedAssetId &&
        lastAppliedVersionId &&
        data.versionId === lastAppliedVersionId
      ) {
        setTimeout(() => {
          loadVersionsForAsset(currentJob.id, singleSelectedAssetId)
            .then(() => {
              const afterRefreshOrdered = orderVersionsOldestFirst(getAssetVersions(singleSelectedAssetId))
              const latestId = getNewestGeneratedVersionIdForMainStage(afterRefreshOrdered)
              setViewedVersionId(singleSelectedAssetId, latestId)
            })
            .catch(() => undefined)
        }, 250)
      }
    })

    return unsubscribe
  }, [currentJob?.id, singleSelectedAssetId, lastAppliedVersionId])

  const resolvedViewedGenerationStatus = resolveGenerationStatus(viewedVersion)
  const isViewedPending = resolvedViewedGenerationStatus === 'pending'
  const isViewedFailed = resolvedViewedGenerationStatus === 'failed'

  const handleApproveViewed = async () => {
    if (!currentJob) return
    if (!singleSelectedAssetId) return
    if (!viewedVersionId) return
    setHeaderInlineMessage(null)
    await approveVersion(currentJob.id, viewedVersionId)
    await loadVersionsForAsset(currentJob.id, singleSelectedAssetId)
  }

  const handleExportViewed = async () => {
    if (!currentJob) return
    if (!viewedVersionId) return

    const suggestedName = (() => {
      const assetPart = selectedAsset?.id ? `_${selectedAsset.id}` : ''
      const statusPart = isViewedApproved ? '_Approved' : '_Draft'
      return `Afterglow${assetPart}${statusPart}`
    })()

    await (globalThis as any)?.window?.api?.invoke?.('version:export', {
      jobId: currentJob.id,
      versionId: viewedVersionId,
      suggestedName
    })
  }

  return (
    <div className="h-full flex flex-col bg-slate-900/50">
      <div className="flex-shrink-0 h-12 border-b border-slate-700 flex items-center px-4 bg-slate-800/50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-xs font-bold text-emerald-300">MAINSTAGE — EDITING SURFACE</div>
          {selectionCount === 1 && viewedVersionId && isViewedPending && (
            <div className="flex items-center gap-1.5 text-xs text-slate-300" data-testid="mainstage-generation-indicator">
              <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
              <span className="truncate">Generating…</span>
            </div>
          )}
          {selectionCount === 1 && viewedVersionId && isViewedFailed && (
            <div className="flex items-center gap-1.5 text-xs text-slate-300" data-testid="mainstage-generation-indicator">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span className="truncate">Generation failed</span>
            </div>
          )}
          {selectionCount === 1 && viewedVersionId && isViewedApproved && (
            <div className="text-[11px] font-semibold text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded" data-testid="mainstage-approved-badge">
              Approved
            </div>
          )}
          {selectionCount === 1 && headerInlineMessage && (
            <div className="text-[11px] text-slate-300" data-testid="mainstage-inline-message">{headerInlineMessage}</div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {selectionCount === 0 && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-slate-400">
              <div className="text-lg font-medium text-slate-200">Select an image from the Library to begin</div>
            </div>
          </div>
        )}

        {selectionCount > 1 && batchView === 'contact' && (
          <div className="h-full flex flex-col gap-4" data-testid="mainstage-contact-sheet">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-300">
                <span className="text-slate-500">Batch:</span>{' '}
                <span className="text-white font-medium">{selectionCount} selected</span>
              </div>
              <div className="text-xs text-slate-500">Press N to toggle focused preview</div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {selectedAssets.map((asset) => {
                const thumb = contactThumbs[asset.id]
                const label = asset.displayName || asset.name
                const viewedId = getViewedVersionId(asset.id)
                const versions = getAssetVersions(asset.id)
                const viewed = viewedId ? versions.find((v) => v.id === viewedId) || null : null
                return (
                  <MainStageTile
                    key={asset.id}
                    asset={asset}
                    viewedVersion={viewed}
                    thumbDataUrl={thumb || null}
                    onClick={() => {
                      setFocusedAssetId(asset.id)
                      setBatchView('focused')
                    }}
                  />
                )
              })}
            </div>
          </div>
        )}

        {selectionCount > 1 && batchView === 'focused' && selectedAsset && (
          <div className="h-full flex flex-col gap-4" data-testid="mainstage-focused-preview">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-300">
                <span className="text-slate-500">Focused:</span>{' '}
                <span className="text-white font-medium">{selectedAsset.displayName || selectedAsset.name}</span>
                <span className="text-slate-500"> — </span>
                <span className="text-slate-300">{selectionCount} selected</span>
              </div>
              <div className="text-xs text-slate-500">Press N to toggle contact sheet</div>
            </div>

            <div className="flex-1 flex items-center justify-center">
              {dataUrl ? (
                <img
                  src={dataUrl}
                  alt="Focused asset"
                  className="max-h-[70vh] max-w-full rounded-lg border border-slate-700 shadow-xl"
                />
              ) : (
                <div className="text-slate-500 text-sm">Loading preview…</div>
              )}
            </div>
          </div>
        )}

        {selectionCount === 1 && selectedAsset && (
          <div className="h-full flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="text-sm text-slate-300 min-w-0">
                <div className="truncate">
                  <span className="text-slate-500">Selected:</span>{' '}
                  <span className="text-white font-medium">{selectedAsset.displayName || selectedAsset.name}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 min-w-0">
                  <VersionDots
                    count={1 + orderedVersionsForSingle.length}
                    activeIndex={activeVersionIndex}
                    getState={(index) =>
                      getDotStateForMainStage({
                        index,
                        orderedVersionsOldestFirst: orderedVersionsForSingle
                      })
                    }
                    isApproved={(index) => {
                      if (index === 0) return false
                      const v = orderedVersionsForSingle[index - 1]
                      return !!v && (v.lifecycleStatus === 'approved' || v.status === 'approved')
                    }}
                    getAriaLabel={(index) => {
                      const total = 1 + orderedVersionsForSingle.length
                      if (index === 0) return 'View Original'
                      return `View Version ${index + 1} of ${total}`
                    }}
                    onSelectIndex={(index) => {
                      if (!singleSelectedAssetId) return
                      const next = index === 0 ? null : orderedVersionsForSingle[index - 1]?.id
                      setViewedVersionId(singleSelectedAssetId, next || null)
                    }}
                  />
                  <span className="truncate">{viewingLabel}</span>
                  {displayedPixelWidth ? ` — ${displayedPixelWidth}px` : ''}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button type="button" onClick={() => handlePrevNext(-1)} className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded">Prev</button>
                <button type="button" onClick={() => handlePrevNext(1)} className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded">Next</button>
                <button type="button" onClick={handleShowOriginal} className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded">Show Original</button>
                <button type="button" onClick={handleShowCurrent} className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded">Show Current</button>
                {viewedVersionId && !isViewedApproved && (
                  <button
                    type="button"
                    onClick={handleApproveViewed}
                    className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded"
                    data-testid="mainstage-approve-button"
                  >
                    Approve
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExportViewed}
                  disabled={!viewedVersionId}
                  className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 rounded"
                  data-testid="mainstage-export-button"
                >
                  Export{isViewedApproved ? '' : ' (Draft)'}
                </button>
                <button
                  type="button"
                  onClick={handleShowLastApplied}
                  disabled={!lastAppliedVersionId}
                  className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 rounded"
                >
                  Show Last Applied
                </button>
                <button
                  type="button"
                  onClick={handleDeleteViewed}
                  disabled={!canDeleteViewedVersion}
                  className="px-2 py-1 text-xs bg-slate-800 hover:bg-red-700 disabled:opacity-50 border border-slate-700 rounded"
                  data-testid="mainstage-delete-button"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center relative">
              {dataUrl ? (
                <img
                  src={dataUrl}
                  alt="Selected asset"
                  className="max-h-[70vh] max-w-full rounded-lg border border-slate-700 shadow-xl"
                />
              ) : (
                <div className="text-slate-500 text-sm">Loading preview…</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
