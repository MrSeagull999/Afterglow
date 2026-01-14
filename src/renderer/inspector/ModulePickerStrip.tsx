import React from 'react'
import type { ModuleType } from '../../shared/types'
import { Moon, Eraser, Sofa, PaintBucket, Grid3X3, Settings } from 'lucide-react'

interface ModulePickerStripProps {
  activeModule: ModuleType | null
  onSelectModule: (module: ModuleType | null) => void
  onOpenLibrary: () => void
  onOpenSettings: () => void
}

const MODULES: { id: ModuleType; icon: React.ReactNode; label: string; color: string }[] = [
  { id: 'twilight', icon: <Moon className="w-4 h-4" />, label: 'Twilight', color: 'text-indigo-400' },
  { id: 'clean', icon: <Eraser className="w-4 h-4" />, label: 'Clean', color: 'text-emerald-400' },
  { id: 'stage', icon: <Sofa className="w-4 h-4" />, label: 'Stage', color: 'text-amber-400' },
  { id: 'renovate', icon: <PaintBucket className="w-4 h-4" />, label: 'Renovate', color: 'text-purple-400' }
]

export function ModulePickerStrip({ activeModule, onSelectModule, onOpenLibrary, onOpenSettings }: ModulePickerStripProps) {
  return (
    <div
      data-testid="module-picker-strip"
      className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-slate-800/70 backdrop-blur border-b border-slate-700 overflow-x-auto whitespace-nowrap"
    >
      <div className="text-[11px] font-semibold tracking-wide text-slate-300 mr-1">TOOLS</div>
      {MODULES.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onSelectModule(activeModule === m.id ? null : m.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
            activeModule === m.id
              ? `bg-slate-700 border-slate-500 ${m.color} `
              : 'bg-slate-900/40 border-slate-700 text-slate-200 hover:border-slate-500'
          }`}
        >
          <span className={m.color}>{m.icon}</span>
          <span>{m.label}</span>
        </button>
      ))}

      <div className="flex-1" />

      <button
        type="button"
        onClick={onOpenLibrary}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-900/40 border border-slate-700 text-slate-300 hover:border-slate-500 transition-colors"
      >
        <Grid3X3 className="w-4 h-4" />
        Library
      </button>

      <button
        type="button"
        onClick={onOpenSettings}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-900/40 border border-slate-700 text-slate-300 hover:border-slate-500 transition-colors"
      >
        <Settings className="w-4 h-4" />
        Settings
      </button>
    </div>
  )
}
