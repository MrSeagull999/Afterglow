import React, { useEffect, useState, useCallback } from 'react'
import { useJobStore } from '../../store/useJobStore'
import { useModuleStore } from '../../store/useModuleStore'
import { useAppStore } from '../../store/useAppStore'
import { resolveGenerationStatus } from '../../../shared/resolveGenerationStatus'
import { ModuleGridTile } from './ModuleGridTile'
import { CompareModal } from './CompareModal'
import type { Asset, Version, VersionStatus, ModuleType } from '../../../shared/types'
import {
  Filter,
  Grid,
  List,
  CheckSquare,
  Square,
  Upload,
  Loader2,
  Plus
} from 'lucide-react'

interface ModuleGridProps {
  activeModule: ModuleType | null
  libraryMode?: boolean
}

type FilterStatus = 'all' | 'pending' | 'preview_ready' | 'approved' | 'final_ready' | 'error'

export function ModuleGrid({ activeModule, libraryMode = false }: ModuleGridProps) {
  const {
    currentJob,
    assets,
    versions,
    selectedAssetIds,
    replaceAssetSelection,
    addAssetToSelection,
    toggleAssetSelection,
    selectAllAssets,
    deselectAllAssets,
    loadAssetsForJob,
    loadVersionsForAsset,
    isLoadingAssets
  } = useJobStore()
  const { addToast } = useAppStore()

  const [filter, setFilter] = useState<FilterStatus>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(libraryMode ? 'list' : 'grid')
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [assetVersions, setAssetVersions] = useState<Map<string, Version[]>>(new Map())
  const [compareImages, setCompareImages] = useState<{ original: string; output: string } | null>(null)
  const [versionProgress, setVersionProgress] = useState<Record<string, number>>({})

  // Load versions for all assets
  const loadAllVersions = useCallback(async () => {
    if (!currentJob || assets.length === 0) return
    
    const versionsMap = new Map<string, Version[]>()
    for (const asset of assets) {
      try {
        const versions = await window.api.invoke('version:listForAsset', currentJob.id, asset.id)
        versionsMap.set(asset.id, versions)
      } catch (error) {
        console.error(`Failed to load versions for asset ${asset.id}:`, error)
      }
    }
    setAssetVersions(versionsMap)
  }, [currentJob, assets])

  // Listen for version progress updates
  useEffect(() => {
    const unsubscribe = window.api.onVersionProgress((data) => {
      setVersionProgress(prev => ({ ...prev, [data.versionId]: data.progress }))
      
      // Reload versions when generation completes
      if (data.progress >= 100 && currentJob) {
        setTimeout(() => {
          loadAllVersions()
        }, 500)
      }
    })
    return unsubscribe
  }, [currentJob?.id, loadAllVersions])

  // Load assets when job changes
  useEffect(() => {
    if (currentJob) {
      loadAssetsForJob(currentJob.id)
    }
  }, [currentJob?.id])

  // Load versions when assets change
  useEffect(() => {
    loadAllVersions()
  }, [loadAllVersions])

  // Listen for manual version updates (e.g., when generation starts)
  useEffect(() => {
    const handleVersionsUpdated = () => {
      loadAllVersions()
    }
    window.addEventListener('versionsUpdated', handleVersionsUpdated)
    return () => window.removeEventListener('versionsUpdated', handleVersionsUpdated)
  }, [loadAllVersions])

  // Get the latest version status for an asset
  const getAssetStatus = useCallback((asset: Asset): VersionStatus | 'original' => {
    const versions = assetVersions.get(asset.id) || []
    if (versions.length === 0) return 'original'
    
    // Filter by active module if set
    const relevantVersions = activeModule 
      ? versions.filter(v => v.module === activeModule)
      : versions
    
    if (relevantVersions.length === 0) return 'original'
    
    // Return the status of the most recent version
    const sorted = [...relevantVersions].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    return sorted[0].status
  }, [assetVersions, activeModule])

  const isAssetPending = useCallback(
    (asset: Asset): boolean => {
      const versions = assetVersions.get(asset.id) || []
      if (versions.length === 0) return true

      const relevantVersions = activeModule ? versions.filter((v) => v.module === activeModule) : versions
      if (relevantVersions.length === 0) return true

      const latest = [...relevantVersions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      return resolveGenerationStatus(latest) === 'pending'
    },
    [assetVersions, activeModule]
  )

  // Filter assets based on their version status
  const filteredAssets = assets.filter(asset => {
    if (filter === 'all') return true
    if (filter === 'pending') {
      return isAssetPending(asset)
    }
    return getAssetStatus(asset) === filter
  })

  // Count assets by status
  const statusCounts = {
    all: assets.length,
    pending: assets.filter((a) => isAssetPending(a)).length,
    preview_ready: assets.filter(a => getAssetStatus(a) === 'preview_ready').length,
    approved: assets.filter(a => getAssetStatus(a) === 'approved').length,
    final_ready: assets.filter(a => getAssetStatus(a) === 'final_ready').length,
    error: assets.filter(a => getAssetStatus(a) === 'error').length
  }

  const allSelected = filteredAssets.length > 0 && 
    filteredAssets.every(a => selectedAssetIds.has(a.id))

  // Handle drag and drop import
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

    addToast(`Imported ${files.length} images`, 'success')
    loadAssetsForJob(currentJob.id)
  }, [currentJob?.id])

  const handleImportClick = async () => {
    if (!currentJob) return
    
    const dirPath = await window.electronAPI.openDirectory()
    if (!dirPath) return

    try {
      const images = await window.electronAPI.scanDirectory(dirPath)
      if (images.length === 0) {
        addToast('No images found in selected folder', 'error')
        return
      }

      for (const img of images) {
        await window.api.invoke('asset:create', {
          jobId: currentJob.id,
          name: img.name,
          originalPath: img.path
        })
      }

      addToast(`Imported ${images.length} images`, 'success')
      loadAssetsForJob(currentJob.id)
    } catch (error) {
      console.error('Import failed:', error)
      addToast('Failed to import images', 'error')
    }
  }

  const handleToggleExpand = (assetId: string) => {
    setExpandedAssetId(expandedAssetId === assetId ? null : assetId)
  }

  const handleCompare = (originalPath: string, outputPath: string) => {
    setCompareImages({ original: originalPath, output: outputPath })
  }

  return (
    <>
      {/* Compare Modal */}
      {compareImages && (
        <CompareModal
          originalPath={compareImages.original}
          outputPath={compareImages.output}
          onClose={() => setCompareImages(null)}
        />
      )}
    <div 
      className="h-full flex flex-col bg-slate-900/50"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Filter Bar */}
      <div className="flex-shrink-0 min-h-12 border-b border-slate-700 flex items-center px-4 gap-4 bg-slate-800/50">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-thin min-w-0">
          {([
            { id: 'all', label: 'All' },
            { id: 'pending', label: 'Pending' },
            { id: 'preview_ready', label: 'Preview' },
            { id: 'approved', label: 'Approved' },
            { id: 'final_ready', label: 'Final' },
            { id: 'error', label: 'Error' }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-2.5 py-1 text-xs rounded transition-colors flex-shrink-0 ${
                filter === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {tab.label}
              {statusCounts[tab.id] > 0 && (
                <span className="ml-1 opacity-70">({statusCounts[tab.id]})</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Selection Controls */}
        <div className="flex items-center gap-2 text-sm">
          {selectedAssetIds.size > 0 && (
            <span className="text-slate-400">
              {selectedAssetIds.size} selected
            </span>
          )}
          <button
            onClick={allSelected ? deselectAllAssets : selectAllAssets}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            {allSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {/* Import Button */}
        <button
          onClick={handleImportClick}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Import
        </button>

        {/* View Toggle */}
        {!libraryMode && (
          <div className="flex items-center border border-slate-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Grid Content */}
      <div className={`flex-1 overflow-y-auto scrollbar-thin p-4 ${
        isDragging ? 'bg-blue-600/10 border-2 border-dashed border-blue-500 m-2 rounded-lg' : ''
      }`}>
        {isDragging ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Upload className="w-12 h-12 mx-auto mb-3 text-blue-400" />
              <p className="text-lg text-blue-400">Drop images here</p>
            </div>
          </div>
        ) : isLoadingAssets ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-slate-500" />
              <h3 className="text-lg font-medium text-slate-300 mb-2">
                {assets.length === 0 ? 'No images yet' : 'No images match filter'}
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                {assets.length === 0 
                  ? 'Drop images here or click Import to get started'
                  : 'Try a different filter or import more images'
                }
              </p>
              {assets.length === 0 && (
                <button
                  onClick={handleImportClick}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Import Images
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className={
            libraryMode
              ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-3'
              : viewMode === 'grid'
                ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4'
                : 'space-y-2'
          }>
            {filteredAssets.map(asset => (
              <ModuleGridTile
                key={asset.id}
                asset={asset}
                versions={assetVersions.get(asset.id) || []}
                activeModule={activeModule}
                isSelected={selectedAssetIds.has(asset.id)}
                isExpanded={expandedAssetId === asset.id}
                viewMode={libraryMode ? 'grid' : viewMode}
                versionProgress={versionProgress}
                onToggleSelect={() => toggleAssetSelection(asset.id)}
                onReplaceSelect={() => replaceAssetSelection(asset.id)}
                onAddToSelect={() => addAssetToSelection(asset.id)}
                onToggleExpand={() => handleToggleExpand(asset.id)}
                onCompare={handleCompare}
                libraryThumbOnly={libraryMode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  )
}
