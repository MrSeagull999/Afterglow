import React from 'react'
import { useAppStore } from '../../store/useAppStore'
import { KIE_IMAGE_MODELS } from '../../../shared/services/provider/kieModels'

export function ProviderSettings() {
  const { settings, setSettings } = useAppStore()
  const inputClass = 'w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500'
  return (
    <div className="space-y-5">
      <div className="p-4 bg-cyan-950/30 border border-cyan-800 rounded-lg space-y-2">
        <label htmlFor="settings-freeform-model" className="block text-sm font-medium text-white">Freeform image model</label>
        <select id="settings-freeform-model" className={inputClass}
          value={settings.freeformImageModel || ''}
          onChange={e => setSettings({ ...settings, freeformImageModel: e.target.value, imageProvider: 'google' })}>
          <option value="">Gemini — use default image model</option>
          {KIE_IMAGE_MODELS.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
        </select>
        <p className="text-xs text-slate-400">Applies to new Freeform edits and batches, including HQ and 4K. You can also change this in the Freeform panel.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="settings-gemini-model" className="block text-sm font-medium text-slate-300">Default Gemini image model</label>
        <select id="settings-gemini-model" className={inputClass}
          value={settings.previewImageModel || settings.previewModel}
          onChange={e => setSettings({ ...settings, previewImageModel: e.target.value, previewModel: e.target.value as typeof settings.previewModel, imageProvider: 'google' })}>
          <option value="gemini-3-pro-image-preview">Gemini 3 Pro Image — best quality</option>
          <option value="gemini-3.1-flash-image">Gemini 3.1 Flash Image (Nano Banana 2) — faster</option>
        </select>
        <p className="text-xs text-slate-400">Used by Sky and Freeform when Gemini is selected. Prompt Builder Chat continues to use Gemini.</p>
      </div>

      <div className="rounded-lg bg-slate-900/60 p-3 text-xs text-slate-400 space-y-2">
        <p className="font-medium text-slate-200">API keys</p>
        <p><code className="text-emerald-400">GEMINI_API_KEY</code> — Gemini images and prompt chat</p>
        <p><code className="text-emerald-400">KIE_API_KEY</code> — Nano Banana and ChatGPT Images via Kie.ai</p>
        <p>Set keys in your .env file and restart AfterGlow. Kie.ai receives the source and reference images when selected.</p>
      </div>

      <details className="rounded-lg border border-slate-700 p-3">
        <summary className="text-sm text-slate-300 cursor-pointer">Advanced generation settings</summary>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <label htmlFor="settings-custom-model" className="block text-sm text-slate-300">Custom Gemini model</label>
            <input id="settings-custom-model" className={inputClass} value={settings.advancedCustomModel || ''}
              placeholder="Leave blank to use the selected model"
              onChange={e => setSettings({ ...settings, advancedCustomModel: e.target.value })} />
            <p className="text-xs text-slate-400">For workflows that support a custom Gemini model. Freeform HQ and 4K keep the model used for the source version.</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="settings-prompt-style" className="block text-sm text-slate-300">Preset prompt style</label>
            <select id="settings-prompt-style" className={inputClass} value={settings.promptStyle || 'full'}
              onChange={e => setSettings({ ...settings, promptStyle: e.target.value as 'full' | 'simplified' })}>
              <option value="full">Detailed</option>
              <option value="simplified">Concise</option>
            </select>
          </div>
        </div>
      </details>

      {/* Auto-Evaluation */}
      <div className="border-t border-slate-700 pt-6">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Auto-Evaluation</h3>
        <label className="flex items-start gap-3 p-3 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-800/50">
          <input
            type="checkbox"
            checked={settings.evaluationEnabled ?? false}
            onChange={(e) => setSettings({ ...settings, evaluationEnabled: e.target.checked })}
            className="w-4 h-4 mt-0.5 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
          />
          <div>
            <div className="text-sm font-medium text-white">Score generated images automatically</div>
            <div className="text-xs text-slate-400 mt-1">
              Uses Gemini to score realism and preservation. Retries generate another image and use additional credits.
            </div>
          </div>
        </label>

        {settings.evaluationEnabled && (
          <div className="mt-3 space-y-3 pl-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Minimum quality score (1-10)
              </label>
              <input
                type="number"
                min={1}
                max={10}
                step={1}
                value={settings.evaluationThreshold ?? 7}
                onChange={(e) => setSettings({ ...settings, evaluationThreshold: parseInt(e.target.value) || 7 })}
                className="w-20 px-2 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500"
              />
              <span className="text-xs text-slate-500 ml-2">Below this score, generation may be retried</span>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Max retries per image
              </label>
              <input
                type="number"
                min={0}
                max={3}
                step={1}
                value={settings.evaluationMaxRetries ?? 1}
                onChange={(e) => setSettings({ ...settings, evaluationMaxRetries: Math.max(0, Math.min(3, Number(e.target.value))) })}
                className="w-20 px-2 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500"
              />
              <span className="text-xs text-slate-500 ml-2">0 = evaluate only, 1–3 = maximum retries</span>
            </div>
          </div>
        )}
      </div>

      {/* Privacy Settings */}
      <div className="border-t border-slate-700 pt-6">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Privacy Settings</h3>
        <label className="flex items-start gap-3 p-3 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-800/50">
          <input
            type="checkbox"
            checked={settings.privacy?.safeFilenamesOnImport ?? true}
            onChange={(e) => {
              setSettings({
                ...settings,
                privacy: { safeFilenamesOnImport: e.target.checked }
              })
            }}
            className="w-4 h-4 mt-0.5 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
          />
          <div>
            <div className="text-sm font-medium text-white">Safe Filenames on Import (Recommended)</div>
            <div className="text-xs text-slate-400 mt-1">
              When enabled, imported files are saved with sanitized names that don't contain
              addresses or personal information. Original filenames are stored as metadata only
              and never sent to external AI providers.
            </div>
          </div>
        </label>
      </div>
    </div>
  )
}
