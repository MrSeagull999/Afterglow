import React, { useEffect, useState, useCallback } from 'react'
import { useJobStore } from '../../store/useJobStore'
import { useAppStore } from '../../store/useAppStore'
import type { Version } from '../../../shared/types'
import { resolveGenerationStatus } from '../../../shared/resolveGenerationStatus'
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Copy,
  Trash2,
  FileText,
  Loader2,
  Image,
  Sparkles,
  Clock,
  Zap,
  Download
} from 'lucide-react'

const MODULE_LABELS: Record<string, { label: string; color: string }> = {
  twilight: { label: 'Twilight', color: 'bg-indigo-600' },
  clean: { label: 'Clean Slate', color: 'bg-emerald-600' },
  stage: { label: 'Staging', color: 'bg-amber-600' },
  renovate: { label: 'Renovate', color: 'bg-purple-600' }
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  generating: { label: 'Generating...', color: 'bg-blue-600' },
  preview_ready: { label: 'Preview', color: 'bg-slate-600' },
  approved: { label: 'Approved', color: 'bg-emerald-600' },
  hq_generating: { label: 'HQ Generating...', color: 'bg-cyan-600' },
  hq_ready: { label: 'HQ Preview', color: 'bg-cyan-600' },
  final_generating: { label: 'Finalizing...', color: 'bg-purple-600' },
  final_ready: { label: '4K Final', color: 'bg-amber-600' },
  error: { label: 'Error', color: 'bg-red-600' }
}

export function VersionCarousel() {
  const {
    currentJob,
    currentAsset,
    versions,
    loadVersionsForAsset,
    approveVersion,
    unapproveVersion,
    deleteVersion,
    duplicateVersion,
    isLoadingVersions,
    selectedVersionId,
    setSelectedVersionId
  } = useJobStore()
  const { addToast } = useAppStore()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [showRecipe, setShowRecipe] = useState(false)
  const [versionProgress, setVersionProgress] = useState<Record<string, number>>({})

  // Listen for progress updates
  useEffect(() => {
    const unsubscribe = window.api.onVersionProgress((data) => {
      setVersionProgress(prev => ({ ...prev, [data.versionId]: data.progress }))
      // Reload versions when complete
      if (data.progress >= 100 && currentJob && currentAsset) {
        setTimeout(() => {
          loadVersionsForAsset(currentJob.id, currentAsset.id)
        }, 500)
      }
    })
    return unsubscribe
  }, [currentJob?.id, currentAsset?.id])

  useEffect(() => {
    if (currentJob && currentAsset) {
      loadVersionsForAsset(currentJob.id, currentAsset.id)
    }
  }, [currentJob?.id, currentAsset?.id])

  useEffect(() => {
    if (versions.length > 0 && currentIndex >= versions.length) {
      setCurrentIndex(versions.length - 1)
    }
  }, [versions.length])

  const currentVersion = versions[currentIndex]
  const resolvedCurrentGenerationStatus = resolveGenerationStatus(currentVersion)
  const isPending = resolvedCurrentGenerationStatus === 'pending'

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1)
  }

  const handleNext = () => {
    if (currentIndex < versions.length - 1) setCurrentIndex(currentIndex + 1)
  }

  const handleApprove = async () => {
    if (!currentJob || !currentVersion) return

    try {
      if (currentVersion.status === 'approved') {
        await unapproveVersion(currentJob.id, currentVersion.id)
        addToast('Version unapproved', 'info')
      } else {
        await approveVersion(currentJob.id, currentVersion.id)
        addToast('Version approved', 'success')
      }
    } catch (error) {
      addToast('Failed to update approval', 'error')
    }
  }

  const handleDelete = async () => {
    if (!currentJob || !currentVersion) return

    if (currentVersion.status === 'approved' || currentVersion.status === 'final_ready') {
      addToast('Cannot delete approved/final versions', 'error')
      return
    }

    if (confirm('Delete this version?')) {
      try {
        await deleteVersion(currentJob.id, currentVersion.id)
        addToast('Version deleted', 'success')
      } catch (error) {
        addToast('Failed to delete version', 'error')
      }
    }
  }

  const handleDuplicate = async () => {
    if (!currentJob || !currentVersion) return

    try {
      const newVersion = await duplicateVersion(currentJob.id, currentVersion.id)
      if (newVersion) {
        setCurrentIndex(0) // New version will be at the top
        addToast('Version duplicated', 'success')
      }
    } catch (error) {
      addToast('Failed to duplicate version', 'error')
    }
  }

  if (!currentAsset) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-slate-500">
          <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select an asset to view versions</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-slate-700">
        <h3 className="font-medium text-white truncate">{currentAsset.name}</h3>
        <p className="text-sm text-slate-400 mt-1">
          {versions.length} version{versions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Version Display */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {isLoadingVersions ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center text-slate-500">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No versions yet</p>
              <p className="text-xs mt-1">Use a module to generate versions</p>
            </div>
          </div>
        ) : (
          <>
            {/* Image Preview */}
            <div className="relative flex-1 min-h-0 bg-slate-900">
              <VersionImage version={currentVersion} />

              {/* Navigation */}
              {versions.length > 1 && (
                <>
                  <button
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-black/80 disabled:opacity-30 rounded-full transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-white" />
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={currentIndex === versions.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-black/80 disabled:opacity-30 rounded-full transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-white" />
                  </button>
                </>
              )}

              {/* Counter */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 rounded-full text-sm text-white">
                {currentIndex + 1} / {versions.length}
              </div>
            </div>

            {/* Version Info */}
            {currentVersion && (
              <div className="flex-shrink-0 p-4 space-y-3 border-t border-slate-700">
                {/* Module & Status */}
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
                      MODULE_LABELS[currentVersion.module]?.color || 'bg-slate-600'
                    }`}
                  >
                    {MODULE_LABELS[currentVersion.module]?.label || currentVersion.module}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
                      STATUS_CONFIG[currentVersion.status]?.color || 'bg-slate-600'
                    }`}
                  >
                    {STATUS_CONFIG[currentVersion.status]?.label || currentVersion.status}
                  </span>
                  {currentVersion.qualityTier === 'final' && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium text-amber-400 bg-amber-400/20">
                      4K
                    </span>
                  )}
                </div>

                {/* Timestamp */}
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  {new Date(currentVersion.createdAt).toLocaleString()}
                </div>

                {/* Progress bar for generating versions */}
                {isPending && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span>Generating...</span>
                      <span>{versionProgress[currentVersion.id] || 0}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${versionProgress[currentVersion.id] || 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleApprove}
                    disabled={
                      isPending
                    }
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentVersion.status === 'approved'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 hover:bg-emerald-600 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    {currentVersion.status === 'approved' ? 'Approved' : 'Approve'}
                  </button>

                  {/* Generate HQ Preview button - for approved versions (for chaining) */}
                  {currentVersion.status === 'approved' && (
                    <button
                      onClick={async () => {
                        if (!currentJob) return
                        try {
                          await window.api.invoke('version:generateHQPreview', currentJob.id, currentVersion.id)
                          addToast('HQ Preview generation started', 'success')
                          loadVersionsForAsset(currentJob.id, currentAsset!.id)
                        } catch (error) {
                          addToast('Failed to start HQ generation', 'error')
                        }
                      }}
                      className="p-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
                      title="Generate HQ Preview (~3K, for chaining)"
                    >
                      <Zap className="w-4 h-4 text-white" />
                    </button>
                  )}

                  {/* Generate 4K Final button - for approved or hq_ready versions */}
                  {(currentVersion.status === 'approved' || currentVersion.status === 'hq_ready') && (
                    <button
                      onClick={async () => {
                        if (!currentJob) return
                        try {
                          await window.api.invoke('version:generateFinal', currentJob.id, currentVersion.id)
                          addToast('4K Final generation started', 'success')
                          loadVersionsForAsset(currentJob.id, currentAsset!.id)
                        } catch (error) {
                          addToast('Failed to start final generation', 'error')
                        }
                      }}
                      className="p-2 bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
                      title="Generate 4K Final (for delivery)"
                    >
                      <Download className="w-4 h-4 text-white" />
                    </button>
                  )}

                  <button
                    onClick={() => setShowRecipe(true)}
                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    title="View recipe"
                  >
                    <FileText className="w-4 h-4 text-slate-300" />
                  </button>

                  <button
                    onClick={handleDuplicate}
                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    title="Duplicate"
                  >
                    <Copy className="w-4 h-4 text-slate-300" />
                  </button>

                  <button
                    onClick={handleDelete}
                    disabled={
                      currentVersion.status === 'approved' ||
                      currentVersion.status === 'hq_ready' ||
                      currentVersion.status === 'final_ready'
                    }
                    className="p-2 bg-slate-700 hover:bg-red-600 disabled:opacity-50 disabled:hover:bg-slate-700 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-slate-300" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Recipe Modal */}
      {showRecipe && currentVersion && (
        <RecipeModal version={currentVersion} onClose={() => setShowRecipe(false)} />
      )}
    </div>
  )
}

function VersionImage({ version }: { version: Version }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadImage() {
      setIsLoading(true)
      if (version.outputPath) {
        try {
          const dataUrl = await window.electronAPI.readImageAsDataURL(version.outputPath)
          setImageUrl(dataUrl)
        } catch (error) {
          console.error('Failed to load version image:', error)
        }
      }
      setIsLoading(false)
    }
    loadImage()
  }, [version.outputPath])

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    )
  }

  if (!imageUrl) {
    const resolved = resolveGenerationStatus(version)
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center text-slate-500">
          {resolved === 'pending' ? (
            <>
              <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
              <p className="text-sm">Generating...</p>
            </>
          ) : resolved === 'failed' ? (
            <>
              <X className="w-8 h-8 mx-auto mb-2 text-red-400" />
              <p className="text-sm text-red-400">{version.generationError || version.error || 'Generation failed'}</p>
            </>
          ) : (
            <>
              <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No preview available</p>
            </>
          )}
        </div>
      </div>
    )
  }

  return <img src={imageUrl} alt="Version preview" className="w-full h-full object-contain" />
}

function RecipeModal({ version, onClose }: { version: Version; onClose: () => void }) {
  const { addToast } = useAppStore()

  const handleCopy = () => {
    const recipe = version.recipe
    const text = `Module: ${version.module}
Base Prompt: ${recipe.basePrompt}
Injectors: ${recipe.injectors.join(', ') || 'None'}
Guardrails: ${recipe.guardrails.join(', ') || 'None'}
Settings: ${JSON.stringify(recipe.settings, null, 2)}`

    navigator.clipboard.writeText(text)
    addToast('Recipe copied to clipboard', 'success')
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">Version Recipe</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-slate-400 mb-2">Module</h4>
            <span
              className={`px-2 py-1 rounded text-sm font-medium text-white ${
                MODULE_LABELS[version.module]?.color || 'bg-slate-600'
              }`}
            >
              {MODULE_LABELS[version.module]?.label || version.module}
            </span>
          </div>

          <div>
            <h4 className="text-sm font-medium text-slate-400 mb-2">Base Prompt</h4>
            <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono bg-slate-900/50 p-3 rounded">
              {version.recipe.basePrompt}
            </pre>
          </div>

          {version.recipe.injectors.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-400 mb-2">Injectors</h4>
              <div className="flex flex-wrap gap-2">
                {version.recipe.injectors.map((id) => (
                  <span key={id} className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-sm">
                    {id}
                  </span>
                ))}
              </div>
            </div>
          )}

          {version.recipe.guardrails.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-400 mb-2">Guardrails</h4>
              <div className="flex flex-wrap gap-2">
                {version.recipe.guardrails.map((id) => (
                  <span key={id} className="px-2 py-1 bg-emerald-600/20 text-emerald-400 rounded text-sm">
                    {id}
                  </span>
                ))}
              </div>
            </div>
          )}

          {version.sourceVersionIds.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-400 mb-2">Source Versions</h4>
              <div className="flex flex-wrap gap-2">
                {version.sourceVersionIds.map((id) => (
                  <span key={id} className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-sm font-mono">
                    {id}
                  </span>
                ))}
              </div>
            </div>
          )}

          {version.parentVersionId && (
            <div>
              <h4 className="text-sm font-medium text-slate-400 mb-2">Duplicated From</h4>
              <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-sm font-mono">
                {version.parentVersionId}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
