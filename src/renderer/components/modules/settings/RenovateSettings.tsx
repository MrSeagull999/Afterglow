import React, { useEffect } from 'react'
import { useModuleStore } from '../../../store/useModuleStore'

export function RenovateSettings() {
  const {
    injectors,
    selectedInjectorIds,
    toggleInjector,
    renovateSettings,
    setRenovateChanges,
    floorMaterials,
    floorColors,
    wallColors,
    curtainStyles,
    loadConstants
  } = useModuleStore()

  useEffect(() => {
    loadConstants()
  }, [])

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

  return (
    <div className="p-4 space-y-6">
      {/* Source Info */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Source</label>
        <div className="p-3 bg-slate-900/50 rounded-lg text-sm text-slate-400">
          Uses latest approved version for each image. Expand a tile in the grid to select a specific version.
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
              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
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
              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
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
              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
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
              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
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
              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
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
              className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        )}
      </div>
    </div>
  )
}
