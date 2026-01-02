import React, { useEffect, useState } from 'react'
import { useModuleStore } from '../../store/useModuleStore'
import { useJobStore } from '../../store/useJobStore'
import { useLibraryStore } from '../../store/useLibraryStore'
import { useAppStore } from '../../store/useAppStore'
import {
  Sparkles,
  Loader2,
  Sun,
  Cloud,
  Info
} from 'lucide-react'

export function TwilightPanel() {
  const {
    injectors,
    selectedInjectorIds,
    toggleInjector,
    twilightSettings,
    setTwilightSourceVersion,
    setTwilightPresetId,
    setTwilightLightingCondition,
    isGenerating,
    setIsGenerating
  } = useModuleStore()
  const { currentJob, currentAsset, loadVersionsForAsset } = useJobStore()
  const { selectedSourceVersionId } = useLibraryStore()
  const { addToast, presets } = useAppStore()

  const [twilightPresets, setTwilightPresets] = useState<any[]>([])

  useEffect(() => {
    async function loadPresets() {
      try {
        const allPresets = await window.electronAPI.getPresets()
        setTwilightPresets(allPresets)
      } catch (error) {
        console.error('Failed to load presets:', error)
      }
    }
    loadPresets()
  }, [])

  useEffect(() => {
    if (selectedSourceVersionId) {
      setTwilightSourceVersion(selectedSourceVersionId)
    }
  }, [selectedSourceVersionId])

  const handleGenerate = async () => {
    if (!currentJob || !currentAsset) {
      addToast('Select an asset first', 'error')
      return
    }

    const preset = twilightPresets.find((p) => p.id === twilightSettings.presetId)
    if (!preset) {
      addToast('Select a preset', 'error')
      return
    }

    setIsGenerating(true)
    try {
      await window.api.invoke('module:twilight:generatePreview', {
        jobId: currentJob.id,
        assetId: currentAsset.id,
        sourceVersionId: twilightSettings.sourceVersionId || undefined,
        presetId: twilightSettings.presetId,
        promptTemplate: preset.promptTemplate,
        lightingCondition: twilightSettings.lightingCondition
      })

      addToast('Twilight generation started', 'success')
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
        <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-slate-300">
          Transform daytime photos into stunning twilight/blue-hour scenes with warm interior
          lighting.
        </div>
      </div>

      {/* Source Version */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Source</label>
        <div className="p-3 bg-slate-800 rounded-lg text-sm">
          {twilightSettings.sourceVersionId ? (
            <div className="flex items-center justify-between">
              <span className="text-white">Using selected version</span>
              <button
                onClick={() => setTwilightSourceVersion(null)}
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

      {/* Preset */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Preset</label>
        <select
          value={twilightSettings.presetId}
          onChange={(e) => setTwilightPresetId(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-indigo-500"
        >
          {twilightPresets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
        {twilightPresets.find((p) => p.id === twilightSettings.presetId)?.description && (
          <p className="text-xs text-slate-500 mt-1">
            {twilightPresets.find((p) => p.id === twilightSettings.presetId)?.description}
          </p>
        )}
      </div>

      {/* Lighting Condition */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Original Lighting Condition
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTwilightLightingCondition('overcast')}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
              twilightSettings.lightingCondition === 'overcast'
                ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500'
            }`}
          >
            <Cloud className="w-5 h-5" />
            Overcast
          </button>
          <button
            onClick={() => setTwilightLightingCondition('sunny')}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
              twilightSettings.lightingCondition === 'sunny'
                ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500'
            }`}
          >
            <Sun className="w-5 h-5" />
            Sunny
          </button>
        </div>
      </div>

      {/* Injectors */}
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
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
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

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !currentAsset}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white font-medium rounded-lg transition-colors"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Generate Twilight
          </>
        )}
      </button>
    </div>
  )
}
