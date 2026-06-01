import React, { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

export function CompareModal() {
  const { compareModalOpen, compareImagePath, closeCompareModal, currentRun } = useAppStore()
  const [sliderPosition, setSliderPosition] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const [originalSrc, setOriginalSrc] = useState<string | null>(null)
  const [compareSrc, setCompareSrc] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const image = currentRun?.images.find(img => img.path === compareImagePath)

  useEffect(() => {
    if (!compareModalOpen) {
      setSliderPosition(50)
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

  const handleMouseDown = () => setIsDragging(true)
  const handleMouseUp = () => setIsDragging(false)

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = (x / rect.width) * 100
    setSliderPosition(Math.max(0, Math.min(100, percentage)))
  }

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [])

  if (!compareModalOpen || !image) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative w-full max-w-5xl mx-4">
        <button
          onClick={closeCompareModal}
          className="absolute -top-12 right-0 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-lg font-medium text-white">{image.name}</h3>
            <p className="text-sm text-slate-400">
              {image.finalPath ? 'Original vs Final' : 'Original vs Preview'}
            </p>
          </div>

          {compareSrc ? (
            <div
              ref={containerRef}
              className="relative aspect-video cursor-ew-resize select-none"
              onMouseMove={handleMouseMove}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
            >
              <img
                src={originalSrc || undefined}
                alt="Original"
                className="absolute inset-0 w-full h-full object-contain"
                draggable={false}
              />

              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${sliderPosition}%` }}
              >
                <img
                  src={compareSrc || undefined}
                  alt="Processed"
                  className="absolute inset-0 w-full h-full object-contain"
                  style={{ 
                    width: containerRef.current ? `${containerRef.current.offsetWidth}px` : '100%',
                    maxWidth: 'none'
                  }}
                  draggable={false}
                />
              </div>

              <div
                className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize"
                style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <ChevronLeft className="w-3 h-3 text-slate-800" />
                  <ChevronRight className="w-3 h-3 text-slate-800" />
                </div>
              </div>

              <div className="absolute bottom-4 left-4 px-2 py-1 bg-black/60 rounded text-xs text-white">
                {image.finalPath ? 'Final' : 'Preview'}
              </div>
              <div className="absolute bottom-4 right-4 px-2 py-1 bg-black/60 rounded text-xs text-white">
                Original
              </div>
            </div>
          ) : (
            <div className="aspect-video flex items-center justify-center text-slate-400">
              No preview or final image available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
