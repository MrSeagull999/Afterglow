import React, { useEffect, useState, useCallback } from 'react'
import { useJobStore } from '../../store/useJobStore'
import { useLibraryStore, LibraryVersion } from '../../store/useLibraryStore'
import { useAppStore } from '../../store/useAppStore'
import type { ModuleType, VersionStatus, Asset } from '../../../shared/types'
import {
  Grid3X3,
  Filter,
  Check,
  Clock,
  Sparkles,
  Image,
  Loader2,
  X,
  Plus,
  Upload,
  Play,
  ChevronDown,
  Eraser,
  Sofa,
  PaintBucket,
  Moon,
  Eye,
  EyeOff
} from 'lucide-react'

const MODULE_OPTIONS: { value: ModuleType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Modules' },
  { value: 'twilight', label: 'Twilight' },
  { value: 'clean', label: 'Clean Slate' },
  { value: 'stage', label: 'Staging' },
  { value: 'renovate', label: 'Renovate' }
]

const STATUS_OPTIONS: { value: VersionStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'approved', label: 'Approved' },
  { value: 'hq_ready', label: 'HQ Preview' },
  { value: 'final_ready', label: 'Final' },
  { value: 'preview_ready', label: 'Preview' }
]

const MODULE_ICONS: Record<ModuleType, React.ReactNode> = {
  clean: <Eraser className="w-4 h-4" />,
  stage: <Sofa className="w-4 h-4" />,
  renovate: <PaintBucket className="w-4 h-4" />,
  twilight: <Moon className="w-4 h-4" />
}

type ViewMode = 'assets' | 'versions'

export function LibraryBrowser() {
  const { currentJob, assets, loadAssetsForJob, setCurrentAsset } = useJobStore()
  const {
    libraryVersions,
    isLoading,
    queryLibrary,
    moduleFilter,
    setModuleFilter,
    selectedSourceVersionId,
    setSelectedSourceVersionId
  } = useLibraryStore()
  const { addToast } = useAppStore()

  const [viewMode, setViewMode] = useState<ViewMode>('assets')
  const [statusFilter, setStatusFilter] = useState<VersionStatus | 'all'>('all')
  const [showPreviews, setShowPreviews] = useState(false)
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set())
  const [showModuleMenu, setShowModuleMenu] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (currentJob) {
      loadAssetsForJob(currentJob.id)
      const query: any = { jobId: currentJob.id }
      if (moduleFilter) query.module = moduleFilter
      if (statusFilter !== 'all') query.status = statusFilter
      queryLibrary(query)
    }
  }, [currentJob?.id, moduleFilter, statusFilter])

  const handleModuleChange = (value: string) => {
    setModuleFilter(value === 'all' ? null : (value as ModuleType))
  }

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as VersionStatus | 'all')
  }

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssetIds(prev => {
      const next = new Set(prev)
      if (next.has(assetId)) {
        next.delete(assetId)
      } else {
        next.add(assetId)
      }
      return next
    })
  }

  const handleImportImages = async () => {
    if (!currentJob) return
    try {
      const dirPath = await window.electronAPI.openDirectory()
      if (!dirPath) return

      const images = await window.electronAPI.scanDirectory(dirPath)
      if (images.length === 0) {
        addToast('No images found in selected folder', 'error')
        return
      }

      // Import images directly to library (no scene required)
      for (const img of images) {
        await window.api.invoke('asset:create', {
          jobId: currentJob.id,
          name: img.name,
          originalPath: img.path
          // No sceneId - assets live in library by default
        })
      }

      addToast(`Imported ${images.length} images to Library`, 'success')
      loadAssetsForJob(currentJob.id)
    } catch (error) {
      console.error('Import failed:', error)
      addToast('Failed to import images', 'error')
    }
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (!currentJob) return

    const files = Array.from(e.dataTransfer.files).filter(f =>
      /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name)
    )

    if (files.length === 0) {
      addToast('No valid images found', 'error')
      return
    }

    for (const file of files) {
      await window.api.invoke('asset:create', {
        jobId: currentJob.id,
        name: file.name.replace(/\.[^.]+$/, ''),
        originalPath: file.path
      })
    }

    addToast(`Imported ${files.length} images to Library`, 'success')
    loadAssetsForJob(currentJob.id)
  }, [currentJob?.id])

  const handleRunModule = async (module: ModuleType) => {
    setShowModuleMenu(false)
    if (selectedAssetIds.size === 0) {
      addToast('Select at least one asset first', 'error')
      return
    }

    // For now, select the first asset and open module panel
    const firstAssetId = Array.from(selectedAssetIds)[0]
    const asset = assets.find(a => a.id === firstAssetId)
    if (asset) {
      setCurrentAsset(asset)
      // Signal to parent to switch to modules tab with this module selected
      window.dispatchEvent(new CustomEvent('openModule', { detail: { module, assetId: firstAssetId } }))
    }
  }

  // Filter versions based on showPreviews toggle
  const filteredVersions = libraryVersions.filter(v => {
    if (!showPreviews && v.qualityTier === 'preview' && v.status === 'preview_ready') {
      return false
    }
    return true
  })

  return (
    <div 
      className="h-full flex flex-col"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Header with Import */}
      <div className="p-3 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white">Library</h3>
          <button
            onClick={handleImportImages}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Import
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex bg-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('assets')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'assets' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Assets
          </button>
          <button
            onClick={() => setViewMode('versions')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'versions' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Versions
          </button>
        </div>
      </div>

      {/* Filters (for versions view) */}
      {viewMode === 'versions' && (
        <div className="p-3 border-b border-slate-700 space-y-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400">Filters</span>
          </div>

          <div className="flex gap-2">
            <select
              value={moduleFilter || 'all'}
              onChange={(e) => handleModuleChange(e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500"
            >
              {MODULE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Show previews toggle */}
          <button
            onClick={() => setShowPreviews(!showPreviews)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300"
          >
            {showPreviews ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {showPreviews ? 'Showing previews' : 'Previews hidden (recommended)'}
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isDragging ? (
          <div className="h-full flex items-center justify-center border-2 border-dashed border-blue-500 m-2 rounded-lg bg-blue-500/10">
            <div className="text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-blue-400" />
              <p className="text-sm text-blue-400">Drop images here</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : viewMode === 'assets' ? (
          assets.length === 0 ? (
            <div className="p-4 text-center text-slate-500">
              <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm mb-2">No images yet</p>
              <button
                onClick={handleImportImages}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Import photos to get started
              </button>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {assets.map((asset) => (
                <LibraryAssetItem
                  key={asset.id}
                  asset={asset}
                  isSelected={selectedAssetIds.has(asset.id)}
                  onToggleSelect={() => toggleAssetSelection(asset.id)}
                />
              ))}
            </div>
          )
        ) : filteredVersions.length === 0 ? (
          <div className="p-4 text-center text-slate-500">
            <Grid3X3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No versions found</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredVersions.map((version) => (
              <LibraryVersionItem
                key={version.id}
                version={version}
                isSelected={selectedSourceVersionId === version.id}
                onSelect={() =>
                  setSelectedSourceVersionId(
                    selectedSourceVersionId === version.id ? null : version.id
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Action Bar */}
      {viewMode === 'assets' && selectedAssetIds.size > 0 && (
        <div className="p-3 border-t border-slate-700 bg-slate-800/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">
              {selectedAssetIds.size} selected
            </span>
            <button
              onClick={() => setSelectedAssetIds(new Set())}
              className="text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          </div>

          {/* Run Module dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowModuleMenu(!showModuleMenu)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Play className="w-4 h-4" />
              Run Module
              <ChevronDown className="w-4 h-4" />
            </button>

            {showModuleMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowModuleMenu(false)} />
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-700 border border-slate-600 rounded-lg shadow-xl z-20 overflow-hidden">
                  {(['clean', 'stage', 'renovate', 'twilight'] as ModuleType[]).map((mod) => (
                    <button
                      key={mod}
                      onClick={() => handleRunModule(mod)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-600 transition-colors"
                    >
                      {MODULE_ICONS[mod]}
                      <span className="capitalize">{mod === 'clean' ? 'Clean Slate' : mod}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Version selection indicator */}
      {viewMode === 'versions' && selectedSourceVersionId && (
        <div className="p-3 border-t border-slate-700 bg-blue-600/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-400">Version selected for chaining</span>
            <button
              onClick={() => setSelectedSourceVersionId(null)}
              className="p-1 hover:bg-slate-700 rounded"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function LibraryAssetItem({
  asset,
  isSelected,
  onToggleSelect
}: {
  asset: Asset
  isSelected: boolean
  onToggleSelect: () => void
}) {
  const [thumbnail, setThumbnail] = useState<string | null>(null)

  useEffect(() => {
    async function loadThumbnail() {
      try {
        const dataUrl = await window.electronAPI.readImageAsDataURL(asset.originalPath)
        if (dataUrl) setThumbnail(dataUrl)
      } catch (error) {
        console.error('Failed to load thumbnail:', error)
      }
    }
    loadThumbnail()
  }, [asset.originalPath])

  return (
    <div
      onClick={onToggleSelect}
      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-600/20 border border-blue-500/50'
          : 'hover:bg-slate-700/50 border border-transparent'
      }`}
    >
      {/* Selection checkbox */}
      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
        isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-500'
      }`}>
        {isSelected && <Check className="w-3 h-3 text-white" />}
      </div>

      {/* Thumbnail */}
      <div className="w-12 h-12 rounded overflow-hidden bg-slate-900 flex-shrink-0">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="w-5 h-5 text-slate-600" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{asset.name}</div>
        <div className="text-xs text-slate-500">
          {asset.versionIds.length} versions
        </div>
      </div>
    </div>
  )
}

function LibraryVersionItem({
  version,
  isSelected,
  onSelect
}: {
  version: LibraryVersion
  isSelected: boolean
  onSelect: () => void
}) {
  const [thumbnail, setThumbnail] = useState<string | null>(null)

  useEffect(() => {
    async function loadThumbnail() {
      if (version.thumbnailPath) {
        try {
          const dataUrl = await window.electronAPI.readImageAsDataURL(version.thumbnailPath)
          if (dataUrl) setThumbnail(dataUrl)
        } catch (error) {
          console.error('Failed to load thumbnail:', error)
        }
      }
    }
    loadThumbnail()
  }, [version.thumbnailPath])

  const moduleColors: Record<string, string> = {
    twilight: 'bg-indigo-600',
    clean: 'bg-emerald-600',
    stage: 'bg-amber-600',
    renovate: 'bg-purple-600'
  }

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-600/20 border border-blue-500/50'
          : 'hover:bg-slate-700/50 border border-transparent'
      }`}
    >
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded overflow-hidden bg-slate-900 flex-shrink-0">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="w-5 h-5 text-slate-600" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${
              moduleColors[version.module] || 'bg-slate-600'
            }`}
          >
            {version.module}
          </span>
          {version.status === 'approved' && <Check className="w-3 h-3 text-emerald-400" />}
          {version.status === 'final_ready' && (
            <span className="text-[10px] text-amber-400 font-medium">4K</span>
          )}
        </div>
        <div className="text-xs text-slate-400 truncate mt-0.5">
          {version.sceneName} • {version.assetName}
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
    </div>
  )
}
