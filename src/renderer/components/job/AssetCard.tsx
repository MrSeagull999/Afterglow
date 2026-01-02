import React, { useState, useEffect } from 'react'
import { useJobStore } from '../../store/useJobStore'
import type { Asset } from '../../../shared/types'
import {
  Image,
  Star,
  Loader2,
  MoreVertical,
  Trash2,
  Edit2,
  CheckCircle,
  Clock
} from 'lucide-react'

interface AssetCardProps {
  asset: Asset
  viewMode: 'grid' | 'list'
  isSelected: boolean
  onSelect: () => void
}

export function AssetCard({ asset, viewMode, isSelected, onSelect }: AssetCardProps) {
  const { currentJob, currentScene, deleteAsset } = useJobStore()
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showMenu, setShowMenu] = useState(false)

  const isMaster = currentScene?.masterAssetId === asset.id
  const versionCount = asset.versionIds.length

  useEffect(() => {
    async function loadThumbnail() {
      try {
        if (asset.originalThumbnailPath) {
          const dataUrl = await window.electronAPI.readImageAsDataURL(asset.originalThumbnailPath)
          if (dataUrl) setThumbnail(dataUrl)
        } else {
          const thumbPath = await window.electronAPI.generateThumbnail(asset.originalPath)
          const dataUrl = await window.electronAPI.readImageAsDataURL(thumbPath)
          if (dataUrl) setThumbnail(dataUrl)
        }
      } catch (error) {
        console.error('Failed to load thumbnail:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadThumbnail()
  }, [asset.originalPath, asset.originalThumbnailPath])

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(false)
    if (!currentJob) return

    if (confirm(`Delete "${asset.name}"? This will remove all versions.`)) {
      await deleteAsset(currentJob.id, asset.id)
    }
  }

  if (viewMode === 'list') {
    return (
      <div
        onClick={onSelect}
        className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors ${
          isSelected
            ? 'bg-blue-600/20 border border-blue-500/50'
            : 'bg-slate-800/50 hover:bg-slate-700/50 border border-transparent'
        }`}
      >
        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-900 flex-shrink-0">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
            </div>
          ) : thumbnail ? (
            <img src={thumbnail} alt={asset.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Image className="w-6 h-6 text-slate-600" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white truncate">{asset.name}</span>
            {isMaster && <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {versionCount} versions
            </span>
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowMenu(!showMenu)
          }}
          className="p-2 hover:bg-slate-600 rounded-lg transition-colors relative"
        >
          <MoreVertical className="w-4 h-4 text-slate-400" />
          {showMenu && <AssetMenu onDelete={handleDelete} onClose={() => setShowMenu(false)} />}
        </button>
      </div>
    )
  }

  // Grid view
  return (
    <div
      onClick={onSelect}
      className={`group relative bg-slate-800 rounded-lg overflow-hidden cursor-pointer transition-all ${
        isSelected
          ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900'
          : 'hover:ring-1 hover:ring-slate-600'
      }`}
    >
      {/* Image */}
      <div className="aspect-square relative overflow-hidden bg-slate-900">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
          </div>
        ) : thumbnail ? (
          <img src={thumbnail} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="w-8 h-8 text-slate-600" />
          </div>
        )}

        {/* Badges */}
        {isMaster && (
          <div className="absolute top-2 left-2 p-1.5 bg-amber-500/90 rounded-full">
            <Star className="w-3 h-3 text-white" />
          </div>
        )}

        {versionCount > 0 && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 rounded-full text-xs text-white font-medium">
            {versionCount}
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      </div>

      {/* Info */}
      <div className="p-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white truncate" title={asset.name}>
            {asset.name}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-700 rounded transition-all relative"
          >
            <MoreVertical className="w-4 h-4 text-slate-400" />
            {showMenu && <AssetMenu onDelete={handleDelete} onClose={() => setShowMenu(false)} />}
          </button>
        </div>
      </div>
    </div>
  )
}

function AssetMenu({
  onDelete,
  onClose
}: {
  onDelete: (e: React.MouseEvent) => void
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 z-20 bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1 min-w-[120px]">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClose()
            // TODO: Implement rename
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
        >
          <Edit2 className="w-4 h-4" />
          Rename
        </button>
        <button
          onClick={onDelete}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>
    </>
  )
}
