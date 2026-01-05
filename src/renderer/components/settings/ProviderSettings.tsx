import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

/**
 * Provider Settings Component
 * 
 * UI for configuring AI provider, API keys, model selection, and privacy settings.
 * Integrated with main settings store for proper persistence.
 */

const CURATED_MODELS = [
  { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image Preview (Recommended)', recommended: true },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
  { value: 'gemini-3-flash-preview-thinking', label: 'Gemini 3 Flash Preview (Thinking)' },
  { value: 'gemini-3-pro-preview-thinking', label: 'Gemini 3 Pro Preview (Thinking)' },
  { value: 'gemini-3-flash-preview-nothinking', label: 'Gemini 3 Flash Preview (No Thinking)' }
]

export function ProviderSettings() {
  const { settings, setSettings } = useAppStore()

  const handleProviderChange = (provider: 'google' | 'openrouter') => {
    setSettings({ ...settings, imageProvider: provider })
  }

  const handleModelChange = (model: string) => {
    setSettings({ ...settings, previewImageModel: model })
  }

  return (
    <div className="space-y-6 p-4">
      {/* Provider Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          AI Provider
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-800/50">
            <input
              type="radio"
              name="provider"
              value="google"
              checked={settings.imageProvider === 'google'}
              onChange={() => handleProviderChange('google')}
              className="w-4 h-4 text-blue-500"
            />
            <div>
              <div className="text-white font-medium">Official Google Gemini</div>
              <div className="text-xs text-slate-400">Direct connection to Google's API (Default)</div>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-800/50">
            <input
              type="radio"
              name="provider"
              value="openrouter"
              checked={settings.imageProvider === 'openrouter'}
              onChange={() => handleProviderChange('openrouter')}
              className="w-4 h-4 text-blue-500"
            />
            <div className="flex-1">
              <div className="text-white font-medium">OpenRouter</div>
              <div className="text-xs text-slate-400">Routes Gemini requests through OpenRouter</div>
            </div>
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          </label>
        </div>
      </div>

      {/* API Key Configuration Note */}
      <div className="flex items-start gap-3 p-3 bg-slate-800 border border-slate-600 rounded-lg">
        <div className="text-sm text-slate-300">
          <strong className="text-white">API Key Configuration</strong>
          <p className="mt-1">
            API keys are configured in your <code className="px-1 py-0.5 bg-slate-700 rounded text-emerald-400">.env</code> file for security:
          </p>
          <ul className="mt-2 space-y-1 text-xs text-slate-400 ml-4 list-disc">
            <li><code className="text-emerald-400">GEMINI_API_KEY</code> - For Official Google Gemini provider</li>
            <li><code className="text-emerald-400">OPENROUTER_API_KEY</code> - For OpenRouter provider</li>
            <li><code className="text-emerald-400">OPENROUTER_BASE_URL</code> - OpenRouter base URL (optional)</li>
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Keys are never stored in settings files or committed to git.
          </p>
        </div>
      </div>

      {/* Warning for third-party providers */}
      {settings.imageProvider === 'openrouter' && (
        <div className="flex items-start gap-3 p-3 bg-amber-900/20 border border-amber-700 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200">
            <strong>Third-party routing layer.</strong> Do not include sensitive or identifying data in prompts.
            OpenRouter routes requests through their infrastructure.
          </div>
        </div>
      )}

      {/* Model Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Preview Model
        </label>
        <select
          value={settings.previewImageModel || 'gemini-3-pro-image-preview'}
          onChange={(e) => handleModelChange(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          {CURATED_MODELS.map(model => (
            <option key={model.value} value={model.value}>
              {model.label} {model.recommended ? '⭐' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Advanced Custom Model */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Advanced Custom Model (Optional)
        </label>
        <input
          type="text"
          value={settings.advancedCustomModel || ''}
          onChange={(e) => setSettings({ ...settings, advancedCustomModel: e.target.value })}
          placeholder="e.g., gemini-3.5-pro-image-custom"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <p className="text-xs text-slate-500 mt-1">
          Override the model selection with a custom model name. Leave empty to use dropdown selection.
        </p>
      </div>

      {/* Priority Mode (OpenRouter only) */}
      {settings.imageProvider === 'openrouter' && (
        <div>
          <label className="flex items-center gap-3 p-3 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-800/50">
            <input
              type="checkbox"
              checked={settings.previewPriorityMode ?? true}
              onChange={(e) => {
                setSettings({ ...settings, previewPriorityMode: e.target.checked })
              }}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
            />
            <div>
              <div className="text-sm font-medium text-white">Priority Mode</div>
              <div className="text-xs text-slate-400">
                Request priority routing for faster generation (OpenRouter only)
              </div>
            </div>
          </label>
        </div>
      )}

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
