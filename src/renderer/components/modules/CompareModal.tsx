import React, { useState, useEffect } from 'react'
import { X, RefreshCw } from 'lucide-react'

interface CompareModalProps {
  originalPath: string
  outputPath: string
  onClose: () => void
}

export function CompareModal({ originalPath, outputPath, onClose }: CompareModalProps) {
  const [showOriginal, setShowOriginal] = useState(false)
  const [originalSrc, setOriginalSrc] = useState<string | null>(null)
  const [outputSrc, setOutputSrc] = useState<string | null>(null)

  useEffect(() => {
    async function loadImages() {
      const [orig, out] = await Promise.all([
        window.electronAPI.readImageAsDataURL(originalPath),
        window.electronAPI.readImageAsDataURL(outputPath)
      ])
      setOriginalSrc(orig)
      setOutputSrc(out)
    }
    loadImages()
  }, [originalPath, outputPath])

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-6xl mx-4 h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-medium text-white">Compare</h3>
            <p className="text-sm text-slate-400">
              {showOriginal ? 'Original' : 'Output'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Image */}
        <div className="flex-1 bg-slate-900 rounded-lg overflow-hidden relative">
          {originalSrc && outputSrc ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img
                src={showOriginal ? originalSrc : outputSrc}
                alt={showOriginal ? 'Original' : 'Output'}
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
            {showOriginal ? 'Original' : 'Output'}
          </div>
        </div>

        {/* Toggle Button */}
        <div className="mt-4">
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            {showOriginal ? 'Show Output' : 'Show Original'}
          </button>
        </div>
      </div>
    </div>
  )
}
