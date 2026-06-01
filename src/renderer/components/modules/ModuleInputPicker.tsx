import React, { useState, useEffect } from 'react'
import { useJobStore } from '../../store/useJobStore'
import { useLibraryStore, LibraryVersion } from '../../store/useLibraryStore'
import { ModuleInput } from '../../store/useModuleStore'
import type { Asset, VersionStatus, QualityTier } from '../../../shared/types'
import {
  Image,
  ChevronDown,
  Check,
  Filter,
  X,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react'

interface ModuleInputPickerProps {
  selectedInput: ModuleInput | null
  onSelectInput: (input: ModuleInput | null) => void
  label?: string
}

const STATUS_LABELS: Record<VersionStatus, string> = {
  generating: 'Generating',
  preview_ready: 'Preview',
  approved: 'Approved',
  hq_generating: 'HQ Generating',
  hq_ready: 'HQ Preview',
  final_generating: 'Final Generating',
  final_ready: 'Final',
  error: 'Error'
}

const STATUS_COLORS: Record<VersionStatus, string> = {
  generating: 'bg-yellow-600',
  preview_ready: 'bg-slate-600',
  approved: 'bg-emerald-600',
  hq_generating: 'bg-yellow-600',
  hq_ready: 'bg-blue-600',
  final_generating: 'bg-yellow-600',
  final_ready: 'bg-amber-600',
  error: 'bg-red-600'
}

export function ModuleInputPicker({ selectedInput, onSelectInput, label = 'Input' }: ModuleInputPickerProps) {
  const { currentJob, assets, loadAssetsForJob } = useJobStore()
  const { libraryVersions, queryLibrary, isLoading } = useLibraryStore()
  
  const [isOpen, setIsOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'assets' | 'versions'>('assets')
  const [showPreviews, setShowPreviews] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'approved' | 'all'>('approved')
  const [thumbnail, setThumbnail] = useState<string | null>(null)

  // Load assets and versions when picker opens
  useEffect(() => {
    if (isOpen && currentJob) {
      loadAssetsForJob(currentJob.id)
      queryLibrary({
        jobId: currentJob.id,
        status: statusFilter === 'approved' ? ['approved', 'hq_ready', 'final_ready'] : undefined
      })
    }
  }, [isOpen, currentJob?.id, statusFilter])

  // Load thumbnail for selected input
  useEffect(() => {
    async function loadThumbnail() {
      if (!selectedInput) {
        setThumbnail(null)
        return
      }
      
      try {
        let path: string | undefined
        if (selectedInput.type === 'version' && selectedInput.thumbnailPath) {
          path = selectedInput.thumbnailPath
        } else {
          // Find asset and use original path
          const asset = assets.find(a => a.id === selectedInput.assetId)
          path = asset?.originalPath
        }
        
        if (path) {
          const dataUrl = await window.electronAPI.readImageAsDataURL(path)
          setThumbnail(dataUrl)
        }
      } catch (error) {
        console.error('Failed to load thumbnail:', error)
      }
    }
    loadThumbnail()
  }, [selectedInput, assets])

  const handleSelectAsset = (asset: Asset) => {
    onSelectInput({
      type: 'original',
      assetId: asset.id,
      assetName: asset.name
    })
    setIsOpen(false)
  }

  const handleSelectVersion = (version: LibraryVersion) => {
    onSelectInput({
      type: 'version',
      assetId: version.assetId,
      assetName: version.assetName,
      versionId: version.id,
      versionStatus: version.status,
      qualityTier: version.qualityTier,
      thumbnailPath: version.thumbnailPath
    })
    setIsOpen(false)
  }

  // Filter versions based on settings
  const filteredVersions = libraryVersions.filter(v => {
    if (!showPreviews && v.qualityTier === 'preview' && v.status === 'preview_ready') {
      return false
    }
    return true
  })

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
      
      {/* Selected Input Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-left"
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
          {selectedInput ? (
            <>
              <div className="text-sm text-white truncate">{selectedInput.assetName}</div>
              <div className="flex items-center gap-2 mt-0.5">
                {selectedInput.type === 'version' && selectedInput.versionStatus ? (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${STATUS_COLORS[selectedInput.versionStatus]}`}>
                    {STATUS_LABELS[selectedInput.versionStatus]}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Original</span>
                )}
              </div>
            </>
          ) : (
            <span className="text-sm text-slate-400">Select input from Library...</span>
          )}
        </div>

        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Clear button */}
      {selectedInput && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSelectInput(null)
          }}
          className="absolute top-9 right-12 p-1 hover:bg-slate-600 rounded"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      )}

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-20 max-h-[400px] flex flex-col overflow-hidden">
            {/* View Toggle & Filters */}
            <div className="p-2 border-b border-slate-700 space-y-2">
              <div className="flex bg-slate-900 rounded-lg p-0.5">
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

              {viewMode === 'versions' && (
                <div className="flex items-center justify-between">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'approved' | 'all')}
                    className="px-2 py-1 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:outline-none"
                  >
                    <option value="approved">Approved + HQ + Final</option>
                    <option value="all">All Versions</option>
                  </select>
                  
                  <button
                    onClick={() => setShowPreviews(!showPreviews)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300"
                  >
                    {showPreviews ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {showPreviews ? 'Previews shown' : 'Previews hidden'}
                  </button>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                </div>
              ) : viewMode === 'assets' ? (
                assets.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    No assets in Library
                  </div>
                ) : (
                  <div className="p-1">
                    {assets.map(asset => (
                      <AssetPickerItem
                        key={asset.id}
                        asset={asset}
                        isSelected={selectedInput?.assetId === asset.id && selectedInput?.type === 'original'}
                        onSelect={() => handleSelectAsset(asset)}
                      />
                    ))}
                  </div>
                )
              ) : filteredVersions.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-sm">
                  No versions found
                </div>
              ) : (
                <div className="p-1">
                  {filteredVersions.map(version => (
                    <VersionPickerItem
                      key={version.id}
                      version={version}
                      isSelected={selectedInput?.versionId === version.id}
                      onSelect={() => handleSelectVersion(version)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function AssetPickerItem({
  asset,
  isSelected,
  onSelect
}: {
  asset: Asset
  isSelected: boolean
  onSelect: () => void
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
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
        isSelected ? 'bg-blue-600/20' : 'hover:bg-slate-700/50'
      }`}
    >
      <div className="w-10 h-10 rounded overflow-hidden bg-slate-900 flex-shrink-0">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="w-4 h-4 text-slate-600" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="text-sm text-white truncate">{asset.name}</div>
        <div className="text-xs text-slate-500">Original</div>
      </div>
      {isSelected && <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />}
    </button>
  )
}

function VersionPickerItem({
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

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
        isSelected ? 'bg-blue-600/20' : 'hover:bg-slate-700/50'
      }`}
    >
      <div className="w-10 h-10 rounded overflow-hidden bg-slate-900 flex-shrink-0">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="w-4 h-4 text-slate-600" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="text-sm text-white truncate">{version.assetName}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${STATUS_COLORS[version.status]}`}>
            {STATUS_LABELS[version.status]}
          </span>
          <span className="text-[10px] text-slate-500 capitalize">{version.module}</span>
        </div>
      </div>
      {isSelected && <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />}
    </button>
  )
}

export type { ModuleInput }
