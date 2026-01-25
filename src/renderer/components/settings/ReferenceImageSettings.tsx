import React, { useEffect, useState } from 'react'
import { Plus, Trash2, Image as ImageIcon, ChevronDown, ChevronRight } from 'lucide-react'
import type { ReferenceImage, ModuleType } from '../../../shared/types'

const MODULES_WITH_REFERENCES: { id: ModuleType; label: string }[] = [
  { id: 'twilight', label: 'Day to Twilight' },
  { id: 'relight', label: 'ReLight' }
]

export function ReferenceImageSettings() {
  const [expandedModule, setExpandedModule] = useState<ModuleType | null>('relight')
  const [referencesByModule, setReferencesByModule] = useState<Record<ModuleType, ReferenceImage[]>>({
    twilight: [],
    relight: [],
    clean: [],
    stage: [],
    renovate: []
  })
  const [isAdding, setIsAdding] = useState(false)
  const [newRefName, setNewRefName] = useState('')
  const [newRefDescription, setNewRefDescription] = useState('')
  const [addingToModule, setAddingToModule] = useState<ModuleType | null>(null)

  useEffect(() => {
    loadAllReferences()
  }, [])

  async function loadAllReferences() {
    const results: Record<ModuleType, ReferenceImage[]> = {
      twilight: [],
      relight: [],
      clean: [],
      stage: [],
      renovate: []
    }

    for (const mod of MODULES_WITH_REFERENCES) {
      try {
        const refs = await window.electronAPI.getReferenceImages(mod.id)
        results[mod.id] = refs
      } catch (error) {
        console.error(`Failed to load references for ${mod.id}:`, error)
      }
    }

    setReferencesByModule(results)
  }

  async function handleAddReference(module: ModuleType) {
    const filePath = await window.electronAPI.selectReferenceFile()
    if (!filePath) return

    setAddingToModule(module)
    setIsAdding(true)
    setNewRefName('')
    setNewRefDescription('')
  }

  async function confirmAddReference() {
    if (!addingToModule || !newRefName.trim()) return

    const filePath = await window.electronAPI.selectReferenceFile()
    if (!filePath) {
      setIsAdding(false)
      setAddingToModule(null)
      return
    }

    try {
      await window.electronAPI.addReferenceImage({
        module: addingToModule,
        name: newRefName.trim(),
        sourceImagePath: filePath,
        description: newRefDescription.trim() || undefined
      })
      await loadAllReferences()
    } catch (error) {
      console.error('Failed to add reference:', error)
    }

    setIsAdding(false)
    setAddingToModule(null)
    setNewRefName('')
    setNewRefDescription('')
  }

  async function handleDeleteReference(module: ModuleType, id: string) {
    if (!confirm('Delete this reference image?')) return

    try {
      await window.electronAPI.deleteReferenceImage(module, id)
      await loadAllReferences()
    } catch (error) {
      console.error('Failed to delete reference:', error)
    }
  }

  async function handleQuickAdd(module: ModuleType) {
    const filePath = await window.electronAPI.selectReferenceFile()
    if (!filePath) return

    // Extract filename without extension as default name
    const fileName = filePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Reference'

    try {
      await window.electronAPI.addReferenceImage({
        module,
        name: fileName,
        sourceImagePath: filePath
      })
      await loadAllReferences()
    } catch (error) {
      console.error('Failed to add reference:', error)
    }
  }

  return (
    <div className="space-y-3">
      {MODULES_WITH_REFERENCES.map((mod) => {
        const refs = referencesByModule[mod.id] || []
        const isExpanded = expandedModule === mod.id

        return (
          <div key={mod.id} className="border border-slate-600 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-3 bg-slate-700/50 hover:bg-slate-700 transition-colors">
              <button
                onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                className="flex items-center gap-2 flex-1 text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-sm font-medium text-slate-200">{mod.label}</span>
                <span className="text-xs text-slate-500">({refs.length} references)</span>
              </button>
              <button
                onClick={() => handleQuickAdd(mod.id)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
                title="Add reference image"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {isExpanded && (
              <div className="p-3 space-y-2 bg-slate-800/50">
                {refs.length === 0 ? (
                  <div className="text-center py-4">
                    <ImageIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No reference images</p>
                    <button
                      onClick={() => handleQuickAdd(mod.id)}
                      className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                    >
                      Add your first reference
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {refs.map((ref) => (
                      <ReferenceImageItem
                        key={ref.id}
                        reference={ref}
                        onDelete={() => handleDeleteReference(mod.id, ref.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      <p className="text-xs text-slate-500 mt-2">
        Reference images help the AI match specific lighting styles. Add twilight photos with your preferred look.
      </p>
    </div>
  )
}

function ReferenceImageItem({
  reference,
  onDelete
}: {
  reference: ReferenceImage
  onDelete: () => void
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    loadPreview()
  }, [reference.imagePath])

  async function loadPreview() {
    try {
      const dataUrl = await window.electronAPI.readImageAsDataURL(reference.imagePath)
      setPreviewUrl(dataUrl)
    } catch (error) {
      console.error('Failed to load preview:', error)
    }
  }

  return (
    <div className="flex items-center gap-3 p-2 bg-slate-700/50 rounded-lg">
      <div className="w-12 h-12 rounded overflow-hidden bg-slate-600 flex-shrink-0">
        {previewUrl ? (
          <img src={previewUrl} alt={reference.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-slate-500" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{reference.name}</div>
        {reference.description && (
          <div className="text-xs text-slate-400 truncate">{reference.description}</div>
        )}
      </div>
      <button
        onClick={onDelete}
        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded transition-colors"
        title="Delete reference"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
