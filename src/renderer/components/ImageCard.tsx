import React, { useState, useEffect } from 'react'
import { useAppStore, ImageEntry } from '../store/useAppStore'
import { Check, X, Eye, AlertCircle, Loader2, RefreshCw, Edit2, Sun, Cloud, FileText } from 'lucide-react'
import { PresetPicker } from './PresetPicker'

interface ImageCardProps {
  image: ImageEntry
}

export function ImageCard({ image }: ImageCardProps) {
  const { 
    selectedImages, 
    toggleImageSelection, 
    openCompareModal,
    setImagePreset,
    updateImageInRun,
    currentRun,
    settings
  } = useAppStore()
  
  const [thumbnail, setThumbnail] = useState<string | null>(image.thumbnailBase64 || null)
  const [showCustomPrompt, setShowCustomPrompt] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [isRetrying, setIsRetrying] = useState(false)
  const [showPromptPreview, setShowPromptPreview] = useState(false)
  const isSelected = selectedImages.has(image.path)
  
  const lightingCondition = currentRun?.lightingCondition || settings.defaultLightingCondition

  useEffect(() => {
    if (!thumbnail && !image.thumbnailBase64) {
      window.electronAPI.generateThumbnail(image.path)
        .then(async thumbPath => {
          const dataURL = await window.electronAPI.readImageAsDataURL(thumbPath)
          if (dataURL) setThumbnail(dataURL)
        })
        .catch(console.error)
    }
  }, [image.path, thumbnail, image.thumbnailBase64])

  const statusConfig = {
    pending: { color: 'bg-slate-600', label: 'Pending' },
    preview_generating: { color: 'bg-blue-600', label: 'Generating...' },
    preview_ready: { color: 'bg-green-600', label: 'Preview Ready' },
    approved: { color: 'bg-emerald-600', label: 'Approved' },
    rejected: { color: 'bg-red-600', label: 'Rejected' },
    final_generating: { color: 'bg-purple-600', label: 'Finalizing...' },
    final_ready: { color: 'bg-amber-600', label: 'Final Ready' },
    error: { color: 'bg-red-700', label: 'Error' }
  }

  const status = statusConfig[image.status] || statusConfig.pending

  const handleApprove = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (image.status === 'preview_ready' || image.status === 'approved') {
      const newStatus = image.status === 'approved' ? 'preview_ready' : 'approved'
      updateImageInRun(image.path, { status: newStatus })
    }
  }

  const handleReject = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateImageInRun(image.path, { status: 'rejected' })
  }

  const handleRetryPreview = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const { currentRun } = useAppStore.getState()
    if (!currentRun) return
    
    setIsRetrying(true)
    try {
      updateImageInRun(image.path, { status: 'preview_generating', error: undefined })
      
      const params: any = {
        runId: currentRun.id,
        imagePath: image.path,
        presetId: image.presetId
      }
      
      if (customPrompt.trim()) {
        params.customPrompt = customPrompt.trim()
      }
      
      await window.electronAPI.generatePreview(params)
      setShowCustomPrompt(false)
      setCustomPrompt('')
    } catch (error) {
      console.error('Failed to retry preview:', error)
      updateImageInRun(image.path, { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Failed to generate preview' 
      })
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <div 
      className={`relative bg-slate-800 rounded-lg overflow-hidden border-2 transition-all cursor-pointer group ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-transparent hover:border-slate-600'
      }`}
      onClick={() => toggleImageSelection(image.path)}
    >
      <div className="aspect-square relative overflow-hidden bg-slate-900">
        {thumbnail ? (
          <img 
            src={thumbnail} 
            alt={image.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
          </div>
        )}
        
        {image.status === 'preview_generating' || image.status === 'final_generating' ? (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
              {image.progress !== undefined && (
                <span className="text-xs text-white mt-2 block">{image.progress}%</span>
              )}
            </div>
          </div>
        ) : null}

        {/* Lighting condition indicator */}
        <div 
          className="absolute top-2 left-2 p-1.5 bg-black/40 backdrop-blur-sm rounded-full"
          title={`Lighting: ${lightingCondition}`}
        >
          {lightingCondition === 'sunny' ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Cloud className="w-3.5 h-3.5 text-blue-300" />
          )}
        </div>

        {/* Action buttons - top right */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {image.previewPath && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                openCompareModal(image.path)
              }}
              className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full"
              title="Compare original vs preview"
            >
              <Eye className="w-4 h-4 text-white" />
            </button>
          )}
          <button
            onClick={async (e) => {
              e.stopPropagation()
              const preset = await window.electronAPI.getPreset(image.presetId)
              if (preset) {
                setShowPromptPreview(true)
              }
            }}
            className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full"
            title="View assembled prompt"
          >
            <FileText className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className={`absolute bottom-2 left-2 px-2 py-0.5 rounded text-xs font-medium text-white ${status.color}`}>
          {status.label}
        </div>

        {isSelected && (
          <div className="absolute bottom-2 left-2 w-5 h-5 bg-blue-500 rounded flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      <div className="p-2 space-y-2">
        <div className="text-sm font-medium text-white truncate" title={image.name}>
          {image.name}
        </div>
        
        <div className="flex items-center gap-1">
          <PresetPicker 
            value={image.presetId} 
            onChange={(presetId) => setImagePreset(image.path, presetId)}
            compact
          />
        </div>

        {image.error && (
          <div className="flex items-start gap-1 text-xs text-red-400">
            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span className="truncate" title={image.error}>{image.error}</span>
          </div>
        )}

        {(image.status === 'error' || image.status === 'pending' || image.status === 'rejected') && (
          <div className="space-y-1">
            {showCustomPrompt && (
              <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Add custom prompt modifications..."
                  className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 resize-none"
                  rows={2}
                />
              </div>
            )}
            <div className="flex items-center gap-1">
              <button
                onClick={handleRetryPreview}
                disabled={isRetrying}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded transition-colors"
              >
                {isRetrying ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                {isRetrying ? 'Generating...' : 'Retry Preview'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowCustomPrompt(!showCustomPrompt)
                }}
                className={`p-1 rounded transition-colors ${
                  showCustomPrompt 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
                title="Custom prompt"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {(image.status === 'preview_ready' || image.status === 'approved') && (
          <div className="space-y-1">
            {showCustomPrompt && (
              <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Add custom prompt modifications..."
                  className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 resize-none"
                  rows={2}
                />
              </div>
            )}
            <div className="flex items-center gap-1">
              <button
                onClick={handleApprove}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                  image.status === 'approved'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 hover:bg-emerald-600 text-slate-300 hover:text-white'
                }`}
              >
                <Check className="w-3 h-3" />
                {image.status === 'approved' ? 'Approved' : 'Approve'}
              </button>
              <button
                onClick={handleRetryPreview}
                disabled={isRetrying}
                className="p-1 bg-slate-700 hover:bg-blue-600 disabled:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors"
                title="Regenerate preview"
              >
                {isRetrying ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowCustomPrompt(!showCustomPrompt)
                }}
                className={`p-1 rounded transition-colors ${
                  showCustomPrompt 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
                title="Custom prompt"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={handleReject}
                className="p-1 bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white rounded transition-colors"
                title="Reject"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Prompt Preview Modal */}
      {showPromptPreview && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            e.stopPropagation()
            setShowPromptPreview(false)
          }}
        >
          <div 
            className="bg-slate-800 rounded-lg max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-white">Assembled Prompt Preview</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {lightingCondition === 'sunny' ? '☀️ Sunny' : '☁️ Overcast'} lighting • {image.presetId}
                </p>
              </div>
              <button
                onClick={() => setShowPromptPreview(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <PromptPreviewContent 
                presetId={image.presetId}
                lightingCondition={lightingCondition}
                customPrompt={customPrompt}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PromptPreviewContent({ 
  presetId, 
  lightingCondition, 
  customPrompt 
}: { 
  presetId: string
  lightingCondition: 'overcast' | 'sunny'
  customPrompt?: string 
}) {
  const [assembledPrompt, setAssembledPrompt] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPrompt() {
      try {
        const preset = await window.electronAPI.getPreset(presetId)
        if (preset) {
          const result = await window.electronAPI.assemblePrompt(
            preset.promptTemplate,
            lightingCondition,
            customPrompt
          )
          setAssembledPrompt(result)
        }
      } catch (error) {
        console.error('Failed to load prompt:', error)
        setAssembledPrompt('Error loading prompt')
      } finally {
        setLoading(false)
      }
    }
    loadPrompt()
  }, [presetId, lightingCondition, customPrompt])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    )
  }

  const sections = assembledPrompt.split('\n\n').filter(s => s.trim())

  return (
    <div className="space-y-4">
      {sections.map((section, i) => (
        <div key={i} className="space-y-2">
          {section.includes('IMPORTANT LIGHTING CORRECTION') && (
            <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
              <Sun className="w-4 h-4" />
              Sunny Lighting Modifier
            </div>
          )}
          {section.includes('Additional instructions:') && (
            <div className="flex items-center gap-2 text-blue-400 text-sm font-medium">
              <Edit2 className="w-4 h-4" />
              Custom Instructions
            </div>
          )}
          <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono bg-slate-900/50 p-3 rounded">
            {section}
          </pre>
        </div>
      ))}
    </div>
  )
}
