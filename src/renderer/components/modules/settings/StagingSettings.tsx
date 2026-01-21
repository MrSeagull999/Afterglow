import React, { useEffect, useState } from 'react'
import { useModuleStore } from '../../../store/useModuleStore'
import { useJobStore } from '../../../store/useJobStore'
import { Star, Layers, Ruler } from 'lucide-react'

export function StagingSettings() {
  const {
    injectors,
    selectedInjectorIds,
    toggleInjector,
    guardrails,
    selectedGuardrailIds,
    toggleGuardrail,
    stagingSettings,
    setStagingRoomType,
    setStagingStyle,
    setStagingIsMasterView,
    setStagingRoomDimensions,
    roomTypes,
    stagingStyles,
    loadConstants
  } = useModuleStore()

  const [enableSceneMode, setEnableSceneMode] = useState(false)

  useEffect(() => {
    loadConstants()
  }, [])

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
          Automatically uses latest approved Clean Slate output for each image, or original if none exists.
        </div>
      </div>

      {/* Room Type */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Room Type</label>
        <select
          value={stagingSettings.roomType}
          onChange={(e) => setStagingRoomType(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-500"
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
          className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-500"
        >
          {stagingStyles.map((style) => (
            <option key={style} value={style}>
              {style}
            </option>
          ))}
        </select>
      </div>

      {/* Room Dimensions */}
      <div>
        <label className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-800/50 transition-colors">
          <input
            type="checkbox"
            checked={stagingSettings.roomDimensions.enabled}
            onChange={(e) => setStagingRoomDimensions({ enabled: e.target.checked })}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm text-white">
              <Ruler className="w-4 h-4 text-amber-400" />
              Specify Room Dimensions
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Help AI scale furniture realistically
            </div>
          </div>
        </label>

        {stagingSettings.roomDimensions.enabled && (
          <div className="mt-3 p-3 bg-slate-900/30 rounded-lg space-y-3">
            <p className="text-xs text-slate-400 mb-2">
              Enter the TOTAL wall length (not just the visible portion). Leave blank if you don't know the dimension.
            </p>
            
            <div className="flex items-center gap-2 mb-2">
              <div className="w-20">
                <label className="block text-xs text-slate-400 mb-1">Unit</label>
                <select
                  value={stagingSettings.roomDimensions.unit}
                  onChange={(e) => setStagingRoomDimensions({ unit: e.target.value as 'feet' | 'meters' })}
                  className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="meters">m</option>
                  <option value="feet">ft</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Back wall width</label>
                <input
                  type="text"
                  value={stagingSettings.roomDimensions.backWall}
                  onChange={(e) => setStagingRoomDimensions({ backWall: e.target.value })}
                  placeholder="e.g. 4"
                  className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Ceiling height</label>
                <input
                  type="text"
                  value={stagingSettings.roomDimensions.ceilingHeight}
                  onChange={(e) => setStagingRoomDimensions({ ceilingHeight: e.target.value })}
                  placeholder="e.g. 2.7"
                  className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Left wall depth</label>
                <input
                  type="text"
                  value={stagingSettings.roomDimensions.leftWall}
                  onChange={(e) => setStagingRoomDimensions({ leftWall: e.target.value })}
                  placeholder="e.g. 3.5"
                  className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Right wall depth</label>
                <input
                  type="text"
                  value={stagingSettings.roomDimensions.rightWall}
                  onChange={(e) => setStagingRoomDimensions({ rightWall: e.target.value })}
                  placeholder="e.g. 3.5"
                  className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Wall-specific dimensions help the AI understand scale. A standard door is ~2.1m tall, a single bed is ~0.9m wide, a queen bed is ~1.5m wide.
            </p>
          </div>
        )}
      </div>

      {/* Multi-Angle Mode Toggle */}
      <div>
        <label className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-800/50 transition-colors">
          <input
            type="checkbox"
            checked={enableSceneMode}
            onChange={(e) => setEnableSceneMode(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm text-white">
              <Layers className="w-4 h-4 text-amber-400" />
              Enable Multi-Angle Mode
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Use scenes for consistent furniture across angles
            </div>
          </div>
        </label>
      </div>

      {/* Scene Mode Options (only shown when enabled) */}
      {enableSceneMode && (
        <div className="p-3 bg-amber-600/10 border border-amber-600/30 rounded-lg space-y-3">
          <div className="flex items-center gap-2 text-sm text-amber-400">
            <Star className="w-4 h-4" />
            Scene Mode Active
          </div>
          <p className="text-xs text-slate-400">
            Select images from the same room, then mark one as the "Master View" by clicking the star icon on its tile. Other images will reference the master's furniture placement.
          </p>
          <label className="flex items-center gap-3 p-2 hover:bg-slate-800/50 rounded cursor-pointer">
            <input
              type="checkbox"
              checked={stagingSettings.isMasterView}
              onChange={(e) => setStagingIsMasterView(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
            />
            <span className="text-sm text-slate-200">First selected image is Master View</span>
          </label>
        </div>
      )}

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
