import React from 'react'
import { useModuleStore } from '../../../store/useModuleStore'

export function CleanSlateSettings() {
  const {
    injectors,
    selectedInjectorIds,
    toggleInjector,
    guardrails,
    selectedGuardrailIds,
    toggleGuardrail
  } = useModuleStore()

  const groupedInjectors = injectors.reduce((acc, inj) => {
    const cat = inj.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(inj)
    return acc
  }, {} as Record<string, typeof injectors>)

  return (
    <div className="p-4 space-y-6">
      {/* Source Info */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Source</label>
        <div className="p-3 bg-slate-900/50 rounded-lg text-sm text-slate-400">
          Uses original images by default. Expand a tile in the grid to select a specific version as source.
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
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
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

      {/* Guardrails */}
      {guardrails.length > 0 && (
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
      )}
    </div>
  )
}
