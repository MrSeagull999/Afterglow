import React, { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { X, Check, RefreshCw } from 'lucide-react'

export function FlipCompareModal() {
  const { compareModalOpen, compareImagePath, closeCompareModal, currentRun, updateImageInRun } = useAppStore()
  const [showOriginal, setShowOriginal] = useState(false)
  const [originalSrc, setOriginalSrc] = useState<string | null>(null)
  const [compareSrc, setCompareSrc] = useState<string | null>(null)

  const image = currentRun?.images.find(img => img.path === compareImagePath)

  useEffect(() => {
    if (!compareModalOpen) {
      setShowOriginal(false)
      setOriginalSrc(null)
      setCompareSrc(null)
    }
  }, [compareModalOpen])

  useEffect(() => {
    if (image && compareModalOpen) {
      window.electronAPI.readImageAsDataURL(image.path).then(setOriginalSrc)
      
      const comparePath = image.finalPath || image.previewPath
      if (comparePath) {
        window.electronAPI.readImageAsDataURL(comparePath).then(setCompareSrc)
      }
    }
  }, [image, compareModalOpen])

  const handleApprove = () => {
    if (image) {
      updateImageInRun(image.path, { status: 'approved' })
      closeCompareModal()
    }
  }

  const handleReject = () => {
    if (image) {
      updateImageInRun(image.path, { status: 'rejected' })
      closeCompareModal()
    }
  }

  if (!compareModalOpen || !image) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="relative w-full max-w-6xl mx-4 h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-medium text-white">{image.name}</h3>
            <p className="text-sm text-slate-400">
              {showOriginal ? 'Original' : (image.finalPath ? 'Final' : 'Preview')}
            </p>
          </div>
          <button
            onClick={closeCompareModal}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 bg-slate-900 rounded-lg overflow-hidden relative">
          {originalSrc && compareSrc ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img
                src={showOriginal ? originalSrc : compareSrc}
                alt={showOriginal ? 'Original' : 'Processed'}
                className="max-w-full max-h-full object-contain"
                draggable={false}
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-slate-400">Loading images...</div>
            </div>
          )}

          <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 rounded text-sm text-white font-medium">
            {showOriginal ? 'Original' : (image.finalPath ? 'Final' : 'Preview')}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            {showOriginal ? 'Show Preview' : 'Show Original'}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReject}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Reject
            </button>
            <button
              onClick={handleApprove}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Check className="w-5 h-5" />
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
