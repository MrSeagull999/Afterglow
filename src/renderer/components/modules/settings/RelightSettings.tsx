import React, { useEffect, useState } from 'react'
import { useModuleStore } from '../../../store/useModuleStore'
import { ReferenceSelector } from '../../shared/ReferenceSelector'

export function RelightSettings() {
  const {
    injectors,
    selectedInjectorIds,
    toggleInjector,
    relightSettings,
    setRelightPresetId,
    setRelightReferenceImage
  } = useModuleStore()

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

  const groupedInjectors = injectors.reduce((acc, inj) => {
    const cat = inj.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(inj)
    return acc
  }, {} as Record<string, typeof injectors>)

  return (
    <div className="p-4 space-y-6">
      {/* Preset */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Lighting Style</label>
        <select
          value={relightSettings.presetId}
          onChange={(e) => setRelightPresetId(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-500"
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

      {/* Reference Image */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Reference Image</label>
        <ReferenceSelector
          module="relight"
          selectedReferenceId={relightSettings.referenceImageId}
          onSelect={setRelightReferenceImage}
        />
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
    </div>
  )
}
