import React, { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { ReferenceImage, ModuleType } from '../../../shared/types'

interface ReferenceSelectorProps {
  module: ModuleType
  selectedReferenceId: string | null
  onSelect: (referenceId: string | null) => void
}

export function ReferenceSelector({ module, selectedReferenceId, onSelect }: ReferenceSelectorProps) {
  const [references, setReferences] = useState<ReferenceImage[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    loadReferences()
  }, [module])

  useEffect(() => {
    if (selectedReferenceId) {
      const index = references.findIndex(ref => ref.id === selectedReferenceId)
      if (index >= 0) {
        setCurrentIndex(index)
      }
    }
  }, [selectedReferenceId, references])

  useEffect(() => {
    if (references.length > 0 && currentIndex >= 0 && currentIndex < references.length) {
      loadPreview(references[currentIndex].imagePath)
    } else {
      setPreviewUrl(null)
    }
  }, [currentIndex, references])

  async function loadReferences() {
    try {
      const refs = await window.electronAPI.getReferenceImages(module)
      setReferences(refs)
      if (refs.length > 0 && !selectedReferenceId) {
        setCurrentIndex(0)
      }
    } catch (error) {
      console.error('Failed to load reference images:', error)
    }
  }

  async function loadPreview(imagePath: string) {
    try {
      const dataUrl = await window.electronAPI.readImageAsDataURL(imagePath)
      setPreviewUrl(dataUrl)
    } catch (error) {
      console.error('Failed to load preview:', error)
      setPreviewUrl(null)
    }
  }

  function handlePrevious() {
    if (references.length === 0) return
    const newIndex = currentIndex > 0 ? currentIndex - 1 : references.length - 1
    setCurrentIndex(newIndex)
    onSelect(references[newIndex].id)
  }

  function handleNext() {
    if (references.length === 0) return
    const newIndex = currentIndex < references.length - 1 ? currentIndex + 1 : 0
    setCurrentIndex(newIndex)
    onSelect(references[newIndex].id)
  }

  function handleClear() {
    onSelect(null)
    setPreviewUrl(null)
  }

  function handleSelect() {
    if (references.length > 0 && currentIndex >= 0 && currentIndex < references.length) {
      onSelect(references[currentIndex].id)
    }
  }

  if (references.length === 0) {
    return (
      <div className="p-3 bg-slate-800/50 rounded-lg text-sm text-slate-400 text-center">
        No reference images available. Add references in Settings.
      </div>
    )
  }

  const currentRef = references[currentIndex]
  const isSelected = selectedReferenceId === currentRef?.id

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={handlePrevious}
          className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white transition-colors"
          disabled={references.length <= 1}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 text-center">
          <div className="text-sm font-medium text-white">
            {currentRef?.name || 'Reference'}
          </div>
          <div className="text-xs text-slate-400">
            {currentIndex + 1} / {references.length}
          </div>
        </div>

        <button
          onClick={handleNext}
          className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white transition-colors"
          disabled={references.length <= 1}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {previewUrl && (
        <div className="relative rounded-lg overflow-hidden bg-slate-900 border border-slate-700">
          <img
            src={previewUrl}
            alt={currentRef?.name}
            className="w-full h-32 object-cover"
          />
        </div>
      )}

      {currentRef?.description && (
        <div className="text-xs text-slate-400 px-2">
          {currentRef.description}
        </div>
      )}

      <div className="flex gap-2">
        {!isSelected ? (
          <button
            onClick={handleSelect}
            className="flex-1 px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded transition-colors"
          >
            Use This Reference
          </button>
        ) : (
          <button
            onClick={handleClear}
            className="flex-1 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors flex items-center justify-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            Clear Reference
          </button>
        )}
      </div>
    </div>
  )
}
