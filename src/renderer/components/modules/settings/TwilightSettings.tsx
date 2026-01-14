import React, { useEffect, useState } from 'react'
import { useModuleStore } from '../../../store/useModuleStore'
import { Sun, Cloud } from 'lucide-react'

export function TwilightSettings() {
  const {
    injectors,
    selectedInjectorIds,
    toggleInjector,
    twilightSettings,
    setTwilightPresetId,
    setTwilightLightingCondition
  } = useModuleStore()

  const [twilightPresets, setTwilightPresets] = useState<any[]>([])

  useEffect(() => {
    async function loadPresets() {
      try {
        const electronAPI = (globalThis as any)?.window?.electronAPI as { getPresets?: () => Promise<any[]> } | undefined
        if (!electronAPI?.getPresets) {
          setTwilightPresets([])
          return
        }

        const allPresets = await electronAPI.getPresets()
        setTwilightPresets(allPresets)
      } catch (error) {
        console.error('Failed to load presets:', error)
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
        <label className="block text-sm font-medium text-slate-300 mb-2">Preset</label>
        <select
          value={twilightSettings.presetId}
          onChange={(e) => setTwilightPresetId(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-indigo-500"
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
          Original Lighting
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTwilightLightingCondition('overcast')}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
              twilightSettings.lightingCondition === 'overcast'
                ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                : 'bg-slate-900 border-slate-600 text-slate-300 hover:border-slate-500'
            }`}
          >
            <Cloud className="w-4 h-4" />
            Overcast
          </button>
          <button
            onClick={() => setTwilightLightingCondition('sunny')}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
              twilightSettings.lightingCondition === 'sunny'
                ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                : 'bg-slate-900 border-slate-600 text-slate-300 hover:border-slate-500'
            }`}
          >
            <Sun className="w-4 h-4" />
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
    </div>
  )
}
