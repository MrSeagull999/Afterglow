import React from 'react'
import { useAppStore } from '../store/useAppStore'
import { ChevronDown } from 'lucide-react'

interface PresetPickerProps {
  value: string
  onChange: (presetId: string) => void
  compact?: boolean
}

export function PresetPicker({ value, onChange, compact = false }: PresetPickerProps) {
  const { presets } = useAppStore()
  const selectedPreset = presets.find(p => p.id === value)

  if (compact) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {presets.map(preset => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-300">Preset</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {presets.map(preset => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>
      {selectedPreset && (
        <p className="text-xs text-slate-400">{selectedPreset.description}</p>
      )}
    </div>
  )
}

export function PresetSelector() {
  const { presets, selectedPresetId, setSelectedPresetId, selectedImages, applyPresetToSelected, addToast } = useAppStore()
  const selectedPreset = presets.find(p => p.id === selectedPresetId)

  const handleApplyToSelected = () => {
    if (selectedImages.size === 0) {
      addToast('No images selected', 'info')
      return
    }
    applyPresetToSelected(selectedPresetId)
    addToast(`Applied "${selectedPreset?.label}" to ${selectedImages.size} images`, 'success')
  }

  return (
    <div className="p-4 bg-slate-800 rounded-lg space-y-4">
      <h3 className="font-medium text-white">Preset</h3>
      
      <select
        value={selectedPresetId}
        onChange={(e) => setSelectedPresetId(e.target.value)}
        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {presets.map(preset => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>
      
      {selectedPreset && (
        <p className="text-xs text-slate-400">{selectedPreset.description}</p>
      )}
      
      <button
        onClick={handleApplyToSelected}
        disabled={selectedImages.size === 0}
        className="w-full px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:text-slate-400 text-white rounded-lg transition-colors"
      >
        Apply to Selected ({selectedImages.size})
      </button>
    </div>
  )
}
