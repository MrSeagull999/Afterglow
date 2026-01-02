import React, { useEffect, useState } from 'react'
import { useJobStore } from '../../store/useJobStore'
import { useLibraryStore, LibraryVersion } from '../../store/useLibraryStore'
import type { ModuleType, VersionStatus } from '../../../shared/types'
import {
  Grid3X3,
  Filter,
  Check,
  Clock,
  Sparkles,
  Image,
  Loader2,
  X
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
  { value: 'final_ready', label: 'Final' },
  { value: 'preview_ready', label: 'Preview' }
]

export function LibraryBrowser() {
  const { currentJob } = useJobStore()
  const {
    libraryVersions,
    isLoading,
    queryLibrary,
    moduleFilter,
    setModuleFilter,
    selectedSourceVersionId,
    setSelectedSourceVersionId
  } = useLibraryStore()

  const [statusFilter, setStatusFilter] = useState<VersionStatus | 'all'>('all')

  useEffect(() => {
    if (currentJob) {
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

  return (
    <div className="h-full flex flex-col">
      {/* Filters */}
      <div className="p-3 border-b border-slate-700 space-y-2">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-400">Filters</span>
        </div>

        <select
          value={moduleFilter || 'all'}
          onChange={(e) => handleModuleChange(e.target.value)}
          className="w-full px-2 py-1.5 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500"
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
          className="w-full px-2 py-1.5 text-sm bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : libraryVersions.length === 0 ? (
          <div className="p-4 text-center text-slate-500">
            <Grid3X3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No versions found</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {libraryVersions.map((version) => (
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

      {/* Selection indicator */}
      {selectedSourceVersionId && (
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
