import React, { useEffect, useState } from 'react'
import { useModuleStore } from '../../store/useModuleStore'
import { useJobStore } from '../../store/useJobStore'
import { useLibraryStore } from '../../store/useLibraryStore'
import { useAppStore } from '../../store/useAppStore'
import {
  Sparkles,
  Loader2,
  Lightbulb,
  Info
} from 'lucide-react'
import { GenerationControlFooter } from './GenerationControlFooter'

export function RelightPanel() {
  const {
    injectors,
    selectedInjectorIds,
    selectedGuardrailIds,
    toggleInjector,
    relightSettings,
    setRelightSourceVersion,
    setRelightPresetId,
    isGenerating,
    setIsGenerating
  } = useModuleStore()
  const { currentJob, currentAsset, loadVersionsForAsset } = useJobStore()
  const { selectedSourceVersionId } = useLibraryStore()
  const { addToast } = useAppStore()

  const [relightPresets, setRelightPresets] = useState<any[]>([])

  useEffect(() => {
    async function loadPresets() {
      try {
        const allPresets = await window.electronAPI.getRelightPresets()
        setRelightPresets(allPresets)
      } catch (error) {
        console.error('Failed to load relight presets:', error)
      }
    }
    loadPresets()
  }, [])

  useEffect(() => {
    if (selectedSourceVersionId) {
      setRelightSourceVersion(selectedSourceVersionId)
    }
  }, [selectedSourceVersionId])

  const handleGenerate = async () => {
    if (!currentJob || !currentAsset) {
      addToast('Select an asset first', 'error')
      return
    }

    const preset = relightPresets.find((p) => p.id === relightSettings.presetId)
    if (!preset) {
      addToast('Select a preset', 'error')
      return
    }

    setIsGenerating(true)
    try {
      await window.api.invoke('module:relight:generatePreview', {
        jobId: currentJob.id,
        assetId: currentAsset.id,
        sourceVersionId: relightSettings.sourceVersionId || undefined,
        presetId: relightSettings.presetId,
        promptTemplate: preset.promptTemplate,
        customInstructions: relightSettings.customInstructions,
        injectorIds: Array.from(selectedInjectorIds),
        customGuardrails: Array.from(selectedGuardrailIds)
      })

      addToast('ReLight generation started', 'success')
      await loadVersionsForAsset(currentJob.id, currentAsset.id)
      
      window.dispatchEvent(new CustomEvent('versionsUpdated', { detail: { assetId: currentAsset.id } }))
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
      <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
        <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-slate-300">
          Enhance existing photos with improved lighting conditions - fix overcast skies, correct color temperature, or transform flat twilight shots.
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Source</label>
        <div className="p-3 bg-slate-800 rounded-lg text-sm">
          {relightSettings.sourceVersionId ? (
            <div className="flex items-center justify-between">
              <span className="text-white">Using selected version</span>
              <button
                onClick={() => setRelightSourceVersion(null)}
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

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Lighting Style</label>
        <select
          value={relightSettings.presetId}
          onChange={(e) => setRelightPresetId(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-500"
        >
          {relightPresets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
        {relightPresets.find((p) => p.id === relightSettings.presetId)?.description && (
          <p className="text-xs text-slate-500 mt-1">
            {relightPresets.find((p) => p.id === relightSettings.presetId)?.description}
          </p>
        )}
      </div>

      {Object.keys(groupedInjectors).length > 0 && (
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
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
                      />
                      <span className="text-sm text-slate-200">{injector.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <GenerationControlFooter module="relight" />

      <button
        onClick={handleGenerate}
        disabled={isGenerating || !currentAsset}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 text-white font-medium rounded-lg transition-colors"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Lightbulb className="w-5 h-5" />
            Enhance Lighting
          </>
        )}
      </button>
    </div>
  )
}
