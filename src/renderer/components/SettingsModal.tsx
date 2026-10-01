import React from 'react'
import { useAppStore, SeedStrategy } from '../store/useAppStore'
import { X, Info } from 'lucide-react'
import { ProviderSettings } from './settings/ProviderSettings'
import { ReferenceImageSettings } from './settings/ReferenceImageSettings'
import { WatchFolderSettings } from './settings/WatchFolderSettings'

export function SettingsModal() {
  const { settingsModalOpen, closeSettingsModal, settings, setSettings, addToast } = useAppStore()

  if (!settingsModalOpen) return null

  const handleSave = async () => {
    try {
      const saved = await window.electronAPI.updateSettings({ ...settings, imageProvider: 'google' })
      setSettings(saved)
      addToast('Settings saved', 'success')
      closeSettingsModal()
    } catch (error) {
      addToast('Failed to save settings', 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative w-full max-w-2xl mx-4 bg-slate-800 rounded-lg shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700 shrink-0 bg-slate-800">
          <h2 className="text-lg font-medium text-white">Settings</h2>
          <button
            onClick={closeSettingsModal}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto min-h-0">
          {/* Provider Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-200 uppercase tracking-wide">AI &amp; image models</h3>
            <ProviderSettings />
          </div>

          <div className="border-t border-slate-700 pt-4 space-y-4">
            <h3 className="text-sm font-medium text-slate-200 uppercase tracking-wide">Gemini seed settings</h3>
            
            <div className="space-y-2">
              <label className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Use seed for consistency</span>
                <input
                  type="checkbox"
                  checked={settings.useSeed}
                  onChange={(e) => setSettings({ ...settings, useSeed: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                />
              </label>
              <p className="text-xs text-slate-500">
                Seeds help maintain consistency between preview and final generation
              </p>
            </div>

            {settings.useSeed && (
              <>
                <div className="space-y-2">
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Reuse preview seed for final</span>
                    <input
                      type="checkbox"
                      checked={settings.reusePreviewSeedForFinal}
                      onChange={(e) => setSettings({ ...settings, reusePreviewSeedForFinal: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                    />
                  </label>
                  <p className="text-xs text-slate-500">
                    Final images will use the same seed as their preview for consistent results
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-300">Seed Strategy</label>
                  <select
                    value={settings.seedStrategy}
                    onChange={(e) => setSettings({ ...settings, seedStrategy: e.target.value as SeedStrategy })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="randomPerImage">Random per image</option>
                    <option value="fixedPerRun">Fixed per run</option>
                  </select>
                </div>

                {settings.seedStrategy === 'fixedPerRun' && (
                  <div className="space-y-2">
                    <label className="text-sm text-slate-300">Fixed Run Seed</label>
                    <input
                      type="number"
                      value={settings.fixedRunSeed ?? ''}
                      onChange={(e) => setSettings({ 
                        ...settings, 
                        fixedRunSeed: e.target.value ? parseInt(e.target.value) : null 
                      })}
                      placeholder="Enter seed number"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </>
            )}

            <div className="flex items-start gap-2 p-3 bg-slate-700/50 rounded-lg">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-400">
                Kie.ai image models do not use seeds. Gemini continues without a seed if its image endpoint rejects it.
              </p>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-4 space-y-4">
            <h3 className="text-sm font-medium text-slate-200 uppercase tracking-wide">Output Settings</h3>

            <div className="space-y-2">
              <label className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Keep EXIF metadata</span>
                <input
                  type="checkbox"
                  checked={settings.keepExif}
                  onChange={(e) => setSettings({ ...settings, keepExif: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                />
              </label>
              <p className="text-xs text-slate-500">
                When disabled, EXIF data is stripped from output images (recommended for privacy)
              </p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Save versions next to original</span>
                <input
                  type="checkbox"
                  checked={settings.mirrorOutputsToSource !== false}
                  onChange={(e) => setSettings({ ...settings, mirrorOutputsToSource: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                />
              </label>
              <p className="text-xs text-slate-500">
                Copies each generated version into the folder the photo was imported from
                (e.g. IMG_1234-AG01.png), so synchronizing that folder in Lightroom picks them up
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-300">Output Format</label>
              <select
                value={settings.outputFormat}
                onChange={(e) => setSettings({ ...settings, outputFormat: e.target.value as 'png' | 'jpeg' })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="png">PNG (lossless)</option>
                <option value="jpeg">JPEG (smaller files)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-300">Concurrent Previews</label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.concurrentPreviews}
                onChange={(e) => setSettings({ ...settings, concurrentPreviews: parseInt(e.target.value) || 3 })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500">
                Number of previews to generate simultaneously (1-10)
              </p>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-4 space-y-4">
            <h3 className="text-sm font-medium text-slate-200 uppercase tracking-wide">Reference Images</h3>
            <ReferenceImageSettings />
          </div>

          <div className="border-t border-slate-700 pt-4 space-y-4">
            <h3 className="text-sm font-medium text-slate-200 uppercase tracking-wide">Watch Folder</h3>
            <WatchFolderSettings />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-700 shrink-0 bg-slate-800">
          <button
            onClick={closeSettingsModal}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
