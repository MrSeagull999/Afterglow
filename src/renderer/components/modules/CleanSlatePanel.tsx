import React, { useEffect } from 'react'
import { useModuleStore } from '../../store/useModuleStore'
import { useJobStore } from '../../store/useJobStore'
import { useLibraryStore } from '../../store/useLibraryStore'
import { useAppStore } from '../../store/useAppStore'
import {
  Sparkles,
  Loader2,
  Check,
  Info
} from 'lucide-react'

export function CleanSlatePanel() {
  const {
    injectors,
    selectedInjectorIds,
    toggleInjector,
    guardrails,
    selectedGuardrailIds,
    toggleGuardrail,
    cleanSlateSettings,
    setCleanSlateSourceVersion,
    setCleanSlateCustomInstructions,
    isGenerating,
    setIsGenerating
  } = useModuleStore()
  const { currentJob, currentAsset, loadVersionsForAsset } = useJobStore()
  const { selectedSourceVersionId } = useLibraryStore()
  const { addToast } = useAppStore()

  useEffect(() => {
    if (selectedSourceVersionId) {
      setCleanSlateSourceVersion(selectedSourceVersionId)
    }
  }, [selectedSourceVersionId])

  const handleGenerate = async () => {
    if (!currentJob || !currentAsset) {
      addToast('Select an asset first', 'error')
      return
    }

    setIsGenerating(true)
    try {
      await window.api.invoke('module:cleanSlate:generatePreview', {
        jobId: currentJob.id,
        assetId: currentAsset.id,
        sourceVersionId: cleanSlateSettings.sourceVersionId || undefined,
        injectorIds: Array.from(selectedInjectorIds),
        customGuardrails: Array.from(selectedGuardrailIds),
        customInstructions: cleanSlateSettings.customInstructions
      })

      addToast('Clean Slate generation started', 'success')
      await loadVersionsForAsset(currentJob.id, currentAsset.id)
    } catch (error) {
      console.error('Failed to generate:', error)
      addToast('Failed to start generation', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const groupedInjectors = injectors.reduce((acc, inj) => {
    const cat = inj.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(inj)
    return acc
  }, {} as Record<string, typeof injectors>)

  return (
    <div className="p-4 space-y-6">
      {/* Description */}
      <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-slate-300">
          Remove furniture and clutter while preserving all architectural details. Perfect for
          preparing rooms for virtual staging.
        </div>
      </div>

      {/* Source Version */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Source</label>
        <div className="p-3 bg-slate-800 rounded-lg text-sm">
          {cleanSlateSettings.sourceVersionId ? (
            <div className="flex items-center justify-between">
              <span className="text-white">Using selected version</span>
              <button
                onClick={() => setCleanSlateSourceVersion(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Clear
              </button>
            </div>
          ) : (
            <span className="text-slate-400">Original image (or select from Library)</span>
          )}
        </div>
      </div>

      {/* Custom Instructions */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Additional Removal Instructions (Optional)
        </label>
        <textarea
          value={cleanSlateSettings.customInstructions}
          onChange={(e) => setCleanSlateCustomInstructions(e.target.value)}
          placeholder="e.g., Remove the two pot plants near the window.&#10;Remove fireplace tools and baskets.&#10;Remove chairs but keep the table."
          rows={4}
          className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
        />
        <p className="text-xs text-slate-500 mt-1">
          Use this to manually specify objects that should be removed if the automatic removal misses them.
        </p>
      </div>

      {/* Injectors */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Options</label>
        <div className="space-y-3">
          {Object.entries(groupedInjectors).map(([category, items]) => (
            <div key={category}>
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                {category.replace(/_/g, ' ')}
              </div>
              <div className="space-y-1">
                {items.map((injector) => (
                  <label
                    key={injector.id}
                    className="flex items-center gap-3 p-2 hover:bg-slate-800/50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedInjectorIds.has(injector.id)}
                      onChange={() => toggleInjector(injector.id)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                    />
                    <span className="text-sm text-slate-200">{injector.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Guardrails */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Guardrails</label>
        <div className="space-y-1">
          {guardrails.map((guardrail) => (
            <label
              key={guardrail.id}
              className="flex items-center gap-3 p-2 hover:bg-slate-800/50 rounded cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedGuardrailIds.has(guardrail.id)}
                onChange={() => toggleGuardrail(guardrail.id)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
              />
              <span className="text-sm text-slate-200">{guardrail.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !currentAsset}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white font-medium rounded-lg transition-colors"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Generate Clean Slate
          </>
        )}
      </button>
    </div>
  )
}
