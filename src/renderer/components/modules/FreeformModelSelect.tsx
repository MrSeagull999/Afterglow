import React, { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { KIE_IMAGE_MODELS } from '../../../shared/services/provider/kieModels'

export function FreeformModelSelect() {
  const { settings, setSettings, addToast } = useAppStore()
  const [saving, setSaving] = useState(false)
  return <div className="space-y-2">
    <label className="block text-sm font-medium text-slate-300" htmlFor="freeform-image-model">Image model</label>
    <select id="freeform-image-model" className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white"
      value={settings.freeformImageModel || ''} disabled={saving}
      onChange={async event => {
        const freeformImageModel = event.target.value
        setSaving(true)
        try {
          const saved = await window.electronAPI.updateSettings({ freeformImageModel })
          setSettings({ ...useAppStore.getState().settings, freeformImageModel: saved.freeformImageModel })
        } catch { addToast('Could not save the image model selection.', 'error') }
        finally { setSaving(false) }
      }}>
      <option value="">Default image model</option>
      {KIE_IMAGE_MODELS.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
    </select>
    {settings.freeformImageModel && <p className="text-xs text-slate-400">Uses your Kie.ai API key. Source and reference images are sent to Kie.ai. Prompt Builder Chat uses your existing chat provider.</p>}
  </div>
}
