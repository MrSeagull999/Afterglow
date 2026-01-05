import React, { useEffect } from 'react'
import { useModuleStore } from '../../store/useModuleStore'
import { useJobStore } from '../../store/useJobStore'
import { useLibraryStore } from '../../store/useLibraryStore'
import { useAppStore } from '../../store/useAppStore'
import {
  Sparkles,
  Loader2,
  Info
} from 'lucide-react'
import { GenerationControlFooter } from './GenerationControlFooter'

export function RenovatePanel() {
  const {
    injectors,
    selectedInjectorIds,
    toggleInjector,
    guardrails,
    selectedGuardrailIds,
    toggleGuardrail,
    renovateSettings,
    setRenovateSourceVersion,
    setRenovateChanges,
    floorMaterials,
    floorColors,
    wallColors,
    curtainStyles,
    isGenerating,
    setIsGenerating,
    loadConstants
  } = useModuleStore()
  const { currentJob, currentAsset, loadVersionsForAsset } = useJobStore()
  const { selectedSourceVersionId } = useLibraryStore()
  const { addToast } = useAppStore()

  useEffect(() => {
    loadConstants()
  }, [])

  useEffect(() => {
    if (selectedSourceVersionId) {
      setRenovateSourceVersion(selectedSourceVersionId)
    }
  }, [selectedSourceVersionId])

  const { changes } = renovateSettings

  const updateFloor = (updates: Partial<typeof changes.floor>) => {
    setRenovateChanges({
      ...changes,
      floor: { ...changes.floor!, ...updates }
    })
  }

  const updateWallPaint = (updates: Partial<typeof changes.wallPaint>) => {
    setRenovateChanges({
      ...changes,
      wallPaint: { ...changes.wallPaint!, ...updates }
    })
  }

  const updateCurtains = (updates: Partial<typeof changes.curtains>) => {
    setRenovateChanges({
      ...changes,
      curtains: { ...changes.curtains!, ...updates }
    })
  }

  const handleGenerate = async () => {
    if (!currentJob || !currentAsset) {
      addToast('Select an asset first', 'error')
      return
    }

    if (!renovateSettings.sourceVersionId) {
      addToast('Select a source version', 'error')
      return
    }

    const hasChanges = changes.floor?.enabled || changes.wallPaint?.enabled || changes.curtains?.enabled
    if (!hasChanges) {
      addToast('Enable at least one change', 'error')
      return
    }

    setIsGenerating(true)
    try {
      await window.api.invoke('module:renovate:generatePreview', {
        jobId: currentJob.id,
        assetId: currentAsset.id,
        sourceVersionId: renovateSettings.sourceVersionId,
        changes: renovateSettings.changes,
        injectorIds: Array.from(selectedInjectorIds),
        customGuardrails: Array.from(selectedGuardrailIds)
      })

      addToast('Renovate generation started', 'success')
      await loadVersionsForAsset(currentJob.id, currentAsset.id)
      
      // Trigger immediate UI refresh
      window.dispatchEvent(new CustomEvent('versionsUpdated', { detail: { assetId: currentAsset.id } }))
    } catch (error) {
      console.error('Failed to generate:', error)
      addToast('Failed to start generation', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="p-4 space-y-6">
      {/* Description */}
      <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
        <Info className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-slate-300">
          Change specific surfaces like floors, wall paint, and curtains while preserving everything
          else.
        </div>
      </div>

      {/* Source Version */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Source</label>
        <div className="p-3 bg-slate-800 rounded-lg text-sm">
          {renovateSettings.sourceVersionId ? (
            <div className="flex items-center justify-between">
              <span className="text-white">Using selected version</span>
              <button
                onClick={() => setRenovateSourceVersion(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Clear
              </button>
            </div>
          ) : (
            <span className="text-slate-400">Select a version from Library</span>
          )}
        </div>
      </div>

      {/* Floor Change */}
      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={changes.floor?.enabled || false}
            onChange={(e) => updateFloor({ enabled: e.target.checked })}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
          />
          <span className="text-sm font-medium text-white">Change Flooring</span>
        </label>

        {changes.floor?.enabled && (
          <div className="pl-7 space-y-2">
            <select
              value={changes.floor.material}
              onChange={(e) => updateFloor({ material: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
            >
              {floorMaterials.map((mat) => (
                <option key={mat} value={mat}>
                  {mat}
                </option>
              ))}
            </select>
            <select
              value={changes.floor.color || ''}
              onChange={(e) => updateFloor({ color: e.target.value || undefined })}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
            >
              <option value="">Select color...</option>
              {floorColors.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Wall Paint Change */}
      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={changes.wallPaint?.enabled || false}
            onChange={(e) => updateWallPaint({ enabled: e.target.checked })}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
          />
          <span className="text-sm font-medium text-white">Change Wall Paint</span>
        </label>

        {changes.wallPaint?.enabled && (
          <div className="pl-7 space-y-2">
            <select
              value={changes.wallPaint.color}
              onChange={(e) => updateWallPaint({ color: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
            >
              {wallColors.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
            <select
              value={changes.wallPaint.finish || ''}
              onChange={(e) =>
                updateWallPaint({
                  finish: (e.target.value as any) || undefined
                })
              }
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
            >
              <option value="">Default finish</option>
              <option value="matte">Matte</option>
              <option value="eggshell">Eggshell</option>
              <option value="satin">Satin</option>
              <option value="semi-gloss">Semi-Gloss</option>
              <option value="gloss">Gloss</option>
            </select>
          </div>
        )}
      </div>

      {/* Curtains Change */}
      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={changes.curtains?.enabled || false}
            onChange={(e) => updateCurtains({ enabled: e.target.checked })}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
          />
          <span className="text-sm font-medium text-white">Change Curtains</span>
        </label>

        {changes.curtains?.enabled && (
          <div className="pl-7 space-y-2">
            <select
              value={changes.curtains.style}
              onChange={(e) => updateCurtains({ style: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
            >
              {curtainStyles.map((style) => (
                <option key={style} value={style}>
                  {style}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={changes.curtains.color || ''}
              onChange={(e) => updateCurtains({ color: e.target.value || undefined })}
              placeholder="Color (e.g., white, navy blue)"
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        )}
      </div>

      {/* Generation Control Footer - Custom Instructions + Prompt Preview */}
      <GenerationControlFooter module="renovate" />

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !currentAsset || !renovateSettings.sourceVersionId}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 text-white font-medium rounded-lg transition-colors"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Generate Renovate
          </>
        )}
      </button>
    </div>
  )
}
