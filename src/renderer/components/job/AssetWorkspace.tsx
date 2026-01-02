import React, { useEffect, useState } from 'react'
import { useJobStore } from '../../store/useJobStore'
import { useAppStore } from '../../store/useAppStore'
import { AssetCard } from './AssetCard'
import { VersionCarousel } from './VersionCarousel'
import type { Asset } from '../../../shared/types'
import {
  Upload,
  FolderOpen,
  Grid,
  List,
  Filter,
  Image,
  Loader2,
  Plus
} from 'lucide-react'

export function AssetWorkspace() {
  const {
    currentJob,
    currentScene,
    currentAsset,
    setCurrentAsset,
    assets,
    loadAssetsForScene,
    createAsset,
    isLoadingAssets
  } = useJobStore()
  const { addToast } = useAppStore()

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (!currentJob || !currentScene) {
      addToast('Select a scene first', 'error')
      return
    }

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
    )

    if (files.length === 0) {
      addToast('No valid images found', 'error')
      return
    }

    for (const file of files) {
      try {
        const name = file.name.replace(/\.[^/.]+$/, '')
        await createAsset(currentJob.id, currentScene.id, name, file.path)
      } catch (error) {
        console.error('Failed to create asset:', error)
      }
    }

    addToast(`Added ${files.length} image(s)`, 'success')
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleUploadClick = async () => {
    if (!currentJob || !currentScene) {
      addToast('Select a scene first', 'error')
      return
    }

    const path = await window.electronAPI.openDirectory()
    if (!path) return

    try {
      const images = await window.electronAPI.scanDirectory(path)
      if (images.length === 0) {
        addToast('No images found in folder', 'error')
        return
      }

      for (const img of images) {
        await createAsset(currentJob.id, currentScene.id, img.name, img.path)
      }

      addToast(`Added ${images.length} image(s)`, 'success')
    } catch (error) {
      addToast('Failed to import images', 'error')
    }
  }

  // No scene selected
  if (!currentScene) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900/50">
        <div className="text-center text-slate-400">
          <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">No Scene Selected</h3>
          <p className="text-sm">Select or create a scene from the sidebar to get started</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 h-12 border-b border-slate-700 flex items-center px-4 gap-4 bg-slate-800/30">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-blue-400" />
          <span className="font-medium text-white">{currentScene.name}</span>
          <span className="text-sm text-slate-400">({assets.length} assets)</span>
        </div>

        <div className="flex-1" />

        <button
          onClick={handleUploadClick}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Images
        </button>

        <div className="flex items-center border border-slate-600 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Asset Grid/List */}
        <div
          className={`flex-1 overflow-y-auto scrollbar-thin p-4 ${
            isDragging ? 'bg-blue-600/10 border-2 border-dashed border-blue-500' : ''
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {isLoadingAssets ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : assets.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Upload className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                <h3 className="text-lg font-medium text-slate-300 mb-2">Drop Images Here</h3>
                <p className="text-sm text-slate-500 mb-4">
                  or click "Add Images" to import from a folder
                </p>
              </div>
            </div>
          ) : (
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
                  : 'space-y-2'
              }
            >
              {assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  viewMode={viewMode}
                  isSelected={currentAsset?.id === asset.id}
                  onSelect={() => setCurrentAsset(asset)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Version Panel (when asset selected) */}
        {currentAsset && (
          <div className="w-96 border-l border-slate-700 flex flex-col bg-slate-800/30">
            <VersionCarousel />
          </div>
        )}
      </div>
    </div>
  )
}
