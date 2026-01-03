import React, { useEffect } from 'react'
import { useModuleStore } from '../../store/useModuleStore'
import { useJobStore } from '../../store/useJobStore'
import { useLibraryStore } from '../../store/useLibraryStore'
import { useAppStore } from '../../store/useAppStore'
import {
  Sparkles,
  Loader2,
  Star,
  Info
} from 'lucide-react'

export function StagingPanel() {
  const {
    injectors,
    selectedInjectorIds,
    toggleInjector,
    guardrails,
    selectedGuardrailIds,
    toggleGuardrail,
    stagingSettings,
    setStagingSourceVersion,
    setStagingRoomType,
    setStagingStyle,
    setStagingIsMasterView,
    roomTypes,
    stagingStyles,
    isGenerating,
    setIsGenerating,
    loadConstants
  } = useModuleStore()
  const { currentJob, currentAsset, currentScene, loadVersionsForAsset } = useJobStore()
  const { selectedSourceVersionId, loadCleanSlateOutputsForStaging, chainableVersions } =
    useLibraryStore()
  const { addToast } = useAppStore()

  useEffect(() => {
    loadConstants()
  }, [])

  useEffect(() => {
    if (currentJob) {
      loadCleanSlateOutputsForStaging(currentJob.id, currentScene?.id)
    }
  }, [currentJob?.id, currentScene?.id])

  useEffect(() => {
    if (selectedSourceVersionId) {
      setStagingSourceVersion(selectedSourceVersionId)
    }
  }, [selectedSourceVersionId])

  const handleGenerate = async () => {
    if (!currentJob || !currentAsset) {
      addToast('Select an asset first', 'error')
      return
    }

    if (!stagingSettings.sourceVersionId) {
      addToast('Select a Clean Slate version as source', 'error')
      return
    }

    setIsGenerating(true)
    try {
      await window.api.invoke('module:staging:generatePreview', {
        jobId: currentJob.id,
        assetId: currentAsset.id,
        sourceVersionId: stagingSettings.sourceVersionId,
        roomType: stagingSettings.roomType,
        style: stagingSettings.style,
        injectorIds: Array.from(selectedInjectorIds),
        customGuardrails: Array.from(selectedGuardrailIds)
      })

      addToast('Staging generation started', 'success')
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
        <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-slate-300">
          Virtually furnish empty rooms with realistic furniture. Works best with Clean Slate
          outputs.
        </div>
      </div>

      {/* Source Version */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Source (Clean Slate or Original)
        </label>
        <select
          value={stagingSettings.sourceVersionId || ''}
          onChange={(e) => setStagingSourceVersion(e.target.value || null)}
          className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">Select source...</option>
          {currentAsset && (
            <option value={`original:${currentAsset.id}`}>
              Use Original Image (skip Clean Slate)
            </option>
          )}
          {chainableVersions
            .filter((v) => v.module === 'clean')
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.assetName} - Clean Slate - {v.status}
              </option>
            ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">
          Use original for already-empty rooms, or select Clean Slate version for furnished rooms
        </p>
      </div>

      {/* Room Type */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Room Type</label>
        <select
          value={stagingSettings.roomType}
          onChange={(e) => setStagingRoomType(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          {roomTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Style */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Style</label>
        <select
          value={stagingSettings.style}
          onChange={(e) => setStagingStyle(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          {stagingStyles.map((style) => (
            <option key={style} value={style}>
              {style}
            </option>
          ))}
        </select>
      </div>

      {/* Master View Toggle */}
      <div>
        <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={stagingSettings.isMasterView}
            onChange={(e) => setStagingIsMasterView(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
          />
          <div>
            <div className="flex items-center gap-2 text-sm text-white">
              <Star className="w-4 h-4 text-amber-400" />
              Master View
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              This view will define furniture placement for other angles
            </div>
          </div>
        </label>
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

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !currentAsset || !stagingSettings.sourceVersionId}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 text-white font-medium rounded-lg transition-colors"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Generate Staging
          </>
        )}
      </button>
    </div>
  )
}
