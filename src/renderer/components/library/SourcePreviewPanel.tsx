import React, { useEffect, useState } from 'react'
import { useJobStore } from '../../store/useJobStore'
import { Image, RotateCcw, Layers } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

interface SourcePreviewPanelProps {
  selectedAssetIds: string[]
}

export function SourcePreviewPanel({ selectedAssetIds }: SourcePreviewPanelProps) {
  const { currentJob, assets, loadAssetsForJob } = useJobStore()
  const addToast = useAppStore((state) => state.addToast)
  const [imageSrc, setImageSrc] = useState<string | null>(null)

  // Get the first selected asset
  const selectedAsset = selectedAssetIds.length === 1
    ? assets.find(a => a.id === selectedAssetIds[0])
    : null

  const hasWorkingSource = !!(selectedAsset?.workingSourcePath && selectedAsset?.workingSourceVersionId)
  const sourceLabel = hasWorkingSource ? 'Custom Source' : 'Original'

  // Load the source image via IPC (file:// URLs are blocked by Electron security)
  useEffect(() => {
    if (!selectedAsset) {
      setImageSrc(null)
      return
    }

    const sourcePath = selectedAsset.workingSourcePath || selectedAsset.originalPath
    if (sourcePath) {
      // Use IPC to read image as data URL
      window.electronAPI.readImageAsDataURL(sourcePath)
        .then((dataUrl) => setImageSrc(dataUrl))
        .catch(() => setImageSrc(null))
    } else {
      setImageSrc(null)
    }
  }, [selectedAsset?.workingSourcePath, selectedAsset?.originalPath, selectedAsset?.id])

  const handleRevertToOriginal = async () => {
    if (!currentJob || !selectedAsset) return
    try {
      await window.api.invoke('asset:setWorkingSource', {
        jobId: currentJob.id,
        assetId: selectedAsset.id,
        versionId: null
      })
      await loadAssetsForJob(currentJob.id)
      addToast('Reverted to original source', 'success')
    } catch (error) {
      addToast('Failed to revert to original', 'error')
    }
  }

  const handleUseLastGenerated = async () => {
    if (!currentJob || !selectedAsset) return
    
    // Get the latest completed version for this asset
    try {
      const versions = await window.api.invoke('version:listForAsset', currentJob.id, selectedAsset.id)
      const completedVersions = versions
        .filter((v: any) => v.outputPath && v.generationStatus === 'completed')
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      
      if (completedVersions.length === 0) {
        addToast('No completed generations to use as source', 'info')
        return
      }

      const lastVersion = completedVersions[0]
      await window.api.invoke('asset:setWorkingSource', {
        jobId: currentJob.id,
        assetId: selectedAsset.id,
        versionId: lastVersion.id
      })
      await loadAssetsForJob(currentJob.id)
      addToast('Set last generation as source', 'success')
    } catch (error) {
      addToast('Failed to set last source', 'error')
    }
  }

  if (selectedAssetIds.length !== 1) {
    return (
      <div className="p-3 border-b border-slate-700 bg-slate-800/50">
        <div className="text-xs text-slate-500 text-center">
          Select a single asset to view source
        </div>
      </div>
    )
  }

  return (
    <div className="border-b border-slate-700 bg-slate-800/50">
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-300">Working Source</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded ${hasWorkingSource ? 'bg-teal-600/30 text-teal-300' : 'bg-slate-600/30 text-slate-400'}`}>
          {sourceLabel}
        </span>
      </div>

      {/* Preview Image */}
      <div className="p-2">
        <div className="relative aspect-video bg-slate-900 rounded overflow-hidden">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt="Source preview"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Image className="w-8 h-8 text-slate-600" />
            </div>
          )}
          
          {/* Source indicator badge */}
          {hasWorkingSource && (
            <div className="absolute top-2 left-2 px-2 py-1 bg-teal-600/90 text-white text-xs rounded shadow">
              Custom Source
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-2 pb-2 flex gap-2">
        <button
          onClick={handleRevertToOriginal}
          disabled={!hasWorkingSource}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
            hasWorkingSource
              ? 'bg-slate-600 hover:bg-slate-500 text-white'
              : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
          }`}
          title="Revert to original image as source"
        >
          <RotateCcw className="w-3 h-3" />
          Original
        </button>
        <button
          onClick={handleUseLastGenerated}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded transition-colors bg-teal-600 hover:bg-teal-500 text-white"
          title="Use the last generated output as source"
        >
          <Layers className="w-3 h-3" />
          Last Output
        </button>
      </div>
    </div>
  )
}
