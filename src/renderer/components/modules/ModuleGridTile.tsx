import React, { useState, useEffect } from 'react'
import { useJobStore } from '../../store/useJobStore'
import { useAppStore } from '../../store/useAppStore'
import type { Asset, Version, VersionStatus, ModuleType } from '../../../shared/types'
import {
  Check,
  X,
  Eye,
  AlertCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileText,
  Star,
  FolderOpen
} from 'lucide-react'

interface ModuleGridTileProps {
  asset: Asset
  versions: Version[]
  activeModule: ModuleType | null
  isSelected: boolean
  isExpanded: boolean
  viewMode: 'grid' | 'list'
  versionProgress: Record<string, number>
  onToggleSelect: () => void
  onToggleExpand: () => void
  onCompare?: (originalPath: string, outputPath: string) => void
}

const STATUS_CONFIG: Record<VersionStatus | 'original', { color: string; label: string }> = {
  original: { color: 'bg-slate-600', label: 'Original' },
  generating: { color: 'bg-yellow-600', label: 'Generating' },
  preview_ready: { color: 'bg-blue-600', label: 'Preview' },
  approved: { color: 'bg-emerald-600', label: 'Approved' },
  hq_generating: { color: 'bg-yellow-600', label: 'HQ Gen' },
  hq_ready: { color: 'bg-indigo-600', label: 'HQ Ready' },
  final_generating: { color: 'bg-purple-600', label: 'Final Gen' },
  final_ready: { color: 'bg-amber-600', label: 'Final' },
  error: { color: 'bg-red-600', label: 'Error' }
}

const MODULE_COLORS: Record<ModuleType, string> = {
  twilight: 'bg-indigo-600',
  clean: 'bg-emerald-600',
  stage: 'bg-amber-600',
  renovate: 'bg-purple-600'
}

export function ModuleGridTile({
  asset,
  versions,
  activeModule,
  isSelected,
  isExpanded,
  viewMode,
  versionProgress,
  onToggleSelect,
  onToggleExpand,
  onCompare
}: ModuleGridTileProps) {
  const { currentJob, approveVersion, unapproveVersion } = useJobStore()
  const { addToast } = useAppStore()
  
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)

  // Load thumbnail
  useEffect(() => {
    async function loadThumbnail() {
      try {
        // Use selected version, latest version, or original
        const selectedVersion = selectedVersionId ? versions.find(v => v.id === selectedVersionId) : null
        const latestVersion = getLatestVersion()
        const displayVersion = selectedVersion || latestVersion
        const path = displayVersion?.outputPath || asset.originalPath
        const dataUrl = await window.electronAPI.readImageAsDataURL(path)
        if (dataUrl) setThumbnail(dataUrl)
      } catch (error) {
        console.error('Failed to load thumbnail:', error)
      }
    }
    loadThumbnail()
  }, [asset.originalPath, versions, selectedVersionId])

  // Get versions filtered by active module
  const getRelevantVersions = () => {
    if (!activeModule) return versions
    return versions.filter(v => v.module === activeModule)
  }

  // Get the latest version (optionally filtered by module)
  const getLatestVersion = (): Version | null => {
    const relevant = getRelevantVersions()
    if (relevant.length === 0) return null
    return [...relevant].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0]
  }

  // Get the currently displayed version (selected or latest)
  const getDisplayedVersion = (): Version | null => {
    if (selectedVersionId) {
      return versions.find(v => v.id === selectedVersionId) || null
    }
    return getLatestVersion()
  }

  // Get current status
  const getCurrentStatus = (): VersionStatus | 'original' => {
    const latest = getLatestVersion()
    return latest?.status || 'original'
  }

  const latestVersion = getLatestVersion()
  const displayedVersion = getDisplayedVersion()
  const currentStatus = getCurrentStatus()
  const statusConfig = STATUS_CONFIG[currentStatus]
  const isGenerating = currentStatus === 'generating' || currentStatus === 'hq_generating' || currentStatus === 'final_generating'

  const handleApprove = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!currentJob || !latestVersion) return
    
    try {
      if (latestVersion.status === 'approved') {
        await unapproveVersion(currentJob.id, latestVersion.id)
        addToast('Version unapproved', 'success')
      } else {
        await approveVersion(currentJob.id, latestVersion.id)
        addToast('Version approved', 'success')
      }
    } catch (error) {
      addToast('Failed to update approval', 'error')
    }
  }

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!currentJob || !latestVersion) return
    
    setIsRetrying(true)
    try {
      // Re-run the generation with same parameters
      await window.api.invoke(`module:${latestVersion.module}:retry`, {
        jobId: currentJob.id,
        versionId: latestVersion.id
      })
      addToast('Retry started', 'success')
    } catch (error) {
      addToast('Failed to retry', 'error')
    } finally {
      setIsRetrying(false)
    }
  }

  const handleCompare = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (latestVersion?.outputPath) {
      if (onCompare) {
        onCompare(asset.originalPath, latestVersion.outputPath)
      } else {
        setShowCompare(true)
      }
    }
  }

  const handleGenerateFinal = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!currentJob || !latestVersion) return
    
    try {
      await window.api.invoke('version:generateFinal', {
        jobId: currentJob.id,
        versionId: latestVersion.id
      })
      addToast('Final generation started', 'success')
    } catch (error) {
      addToast('Failed to start final generation', 'error')
    }
  }

  const handleShowInFinder = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const version = displayedVersion || latestVersion
    const path = version?.outputPath || asset.originalPath
    
    try {
      await window.api.invoke('file:showInFinder', path)
    } catch (error) {
      addToast('Failed to show in Finder', 'error')
    }
  }

  const handleSelectVersion = (versionId: string) => {
    setSelectedVersionId(versionId === selectedVersionId ? null : versionId)
  }

  // Grid view
  if (viewMode === 'grid') {
    return (
      <div className="flex flex-col">
        <div
          onClick={onToggleSelect}
          className={`relative bg-slate-800 rounded-lg overflow-hidden border-2 transition-all cursor-pointer group ${
            isSelected 
              ? 'border-blue-500 ring-2 ring-blue-500/30' 
              : 'border-transparent hover:border-slate-600'
          }`}
        >
          {/* Thumbnail */}
          <div className="aspect-square relative overflow-hidden bg-slate-900">
            {thumbnail ? (
              <img 
                src={thumbnail} 
                alt={asset.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
              </div>
            )}

            {/* Generating overlay */}
            {isGenerating && latestVersion && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="text-center px-4 w-full">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
                  <span className="text-xs text-white mt-2 block font-medium">
                    {currentStatus === 'final_generating' ? 'Generating Final...' : 
                     currentStatus === 'hq_generating' ? 'Generating HQ...' : 'Processing...'}
                  </span>
                  {versionProgress[latestVersion.id] !== undefined && (
                    <div className="mt-2 px-2">
                      <div className="text-xs text-white mb-1 font-medium">{Math.round(versionProgress[latestVersion.id])}%</div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${versionProgress[latestVersion.id]}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Selection checkbox */}
            <div className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
              isSelected 
                ? 'bg-blue-500 border-blue-500' 
                : 'border-white/50 bg-black/30 opacity-0 group-hover:opacity-100'
            }`}>
              {isSelected && <Check className="w-3 h-3 text-white" />}
            </div>

            {/* Status badge */}
            <div className={`absolute bottom-2 left-2 px-2 py-0.5 rounded text-xs font-medium text-white ${statusConfig.color}`}>
              {statusConfig.label}
            </div>

            {/* Module badge (if version exists) */}
            {latestVersion && (
              <div className={`absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${MODULE_COLORS[latestVersion.module]}`}>
                {latestVersion.module}
              </div>
            )}

            {/* Version count indicator */}
            {versions.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleExpand() }}
                className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/60 hover:bg-black/80 rounded text-[10px] text-white flex items-center gap-1"
              >
                {versions.length} versions
                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>

          {/* Info */}
          <div className="p-2">
            <div className="text-sm font-medium text-white truncate" title={asset.name}>
              {asset.name}
            </div>

            {/* Error message */}
            {currentStatus === 'error' && latestVersion?.error && (
              <div className="flex items-start gap-1 text-xs text-red-400 mt-1">
                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span className="truncate" title={latestVersion.error}>{latestVersion.error}</span>
              </div>
            )}

            {/* Action buttons */}
            {latestVersion && !isGenerating && (
              <div className="flex items-center gap-1 mt-2">
                {(currentStatus === 'preview_ready' || currentStatus === 'approved' || currentStatus === 'hq_ready') && (
                  <button
                    onClick={handleApprove}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                      currentStatus === 'approved'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 hover:bg-emerald-600 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                    {currentStatus === 'approved' ? 'Approved' : 'Approve'}
                  </button>
                )}

                {currentStatus === 'approved' && (
                  <button
                    onClick={handleGenerateFinal}
                    className="p-1 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
                    title="Generate Final"
                  >
                    <Sparkles className="w-3 h-3" />
                  </button>
                )}

                {(currentStatus === 'error' || currentStatus === 'preview_ready') && (
                  <button
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="p-1 bg-slate-700 hover:bg-blue-600 disabled:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors"
                    title="Retry"
                  >
                    {isRetrying ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Expanded version history */}
        {isExpanded && versions.length > 0 && (
          <div className="mt-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">Version History (click to view)</div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {[...versions]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map(version => (
                  <VersionHistoryItem 
                    key={version.id} 
                    version={version} 
                    isLatest={version.id === latestVersion?.id}
                    isSelected={version.id === selectedVersionId}
                    onClick={() => handleSelectVersion(version.id)}
                  />
                ))
              }
            </div>
          </div>
        )}
      </div>
    )
  }

  // List view
  return (
    <div
      onClick={onToggleSelect}
      className={`flex items-center gap-4 p-3 bg-slate-800 rounded-lg border-2 transition-all cursor-pointer ${
        isSelected 
          ? 'border-blue-500 ring-2 ring-blue-500/30' 
          : 'border-transparent hover:border-slate-600'
      }`}
    >
      {/* Selection checkbox */}
      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
        isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-500'
      }`}>
        {isSelected && <Check className="w-3 h-3 text-white" />}
      </div>

      {/* Thumbnail */}
      <div className="w-16 h-16 rounded overflow-hidden bg-slate-900 flex-shrink-0">
        {thumbnail ? (
          <img src={thumbnail} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{asset.name}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
          {latestVersion && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${MODULE_COLORS[latestVersion.module]}`}>
              {latestVersion.module}
            </span>
          )}
          <span className="text-xs text-slate-500">{versions.length} versions</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {latestVersion && !isGenerating && (
          <>
            {(currentStatus === 'preview_ready' || currentStatus === 'approved' || currentStatus === 'hq_ready') && (
              <button
                onClick={handleApprove}
                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                  currentStatus === 'approved'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 hover:bg-emerald-600 text-slate-300 hover:text-white'
                }`}
              >
                {currentStatus === 'approved' ? 'Approved' : 'Approve'}
              </button>
            )}
            {latestVersion.outputPath && (
              <button
                onClick={handleCompare}
                className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                title="Compare"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
          </>
        )}
        {isGenerating && (
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
        )}
      </div>
    </div>
  )
}

function VersionHistoryItem({ 
  version, 
  isLatest, 
  isSelected,
  onClick 
}: { 
  version: Version; 
  isLatest: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const statusConfig = STATUS_CONFIG[version.status]
  
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 p-1.5 rounded transition-colors ${
        isSelected 
          ? 'bg-blue-600/50 ring-1 ring-blue-500' 
          : isLatest 
          ? 'bg-slate-700/50 hover:bg-slate-700' 
          : 'hover:bg-slate-700/30'
      }`}
    >
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${MODULE_COLORS[version.module]}`}>
        {version.module}
      </span>
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${statusConfig.color}`}>
        {statusConfig.label}
      </span>
      <span className="text-[10px] text-slate-400 flex-1 text-left">
        {new Date(version.createdAt).toLocaleString()}
      </span>
      {isLatest && !isSelected && (
        <Star className="w-3 h-3 text-amber-400" />
      )}
      {isSelected && (
        <Eye className="w-3 h-3 text-blue-400" />
      )}
    </button>
  )
}
