import React from 'react'
import type { ModuleType } from '../../../shared/types'
import { Moon, Eraser, Sofa, PaintBucket, Lightbulb } from 'lucide-react'

export interface ToolDockProps {
  activeModule: ModuleType | null
  onSelectModule: (module: ModuleType) => void
}

const TOOLS: { id: ModuleType; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'twilight', label: 'Twilight', icon: <Moon className="w-4 h-4" />, color: 'text-indigo-400' },
  { id: 'relight', label: 'ReLight', icon: <Lightbulb className="w-4 h-4" />, color: 'text-amber-400' },
  { id: 'clean', label: 'Clean Slate', icon: <Eraser className="w-4 h-4" />, color: 'text-emerald-400' },
  { id: 'stage', label: 'Staging', icon: <Sofa className="w-4 h-4" />, color: 'text-orange-400' },
  { id: 'renovate', label: 'Renovate', icon: <PaintBucket className="w-4 h-4" />, color: 'text-purple-400' }
]

export function ToolDock({ activeModule, onSelectModule }: ToolDockProps) {
  return (
    <div data-testid="tool-dock" className="flex-shrink-0 border-t border-slate-700 bg-slate-800/40">
      <div className="px-4 py-3 flex items-center gap-3 overflow-x-auto whitespace-nowrap">
        <div className="text-[11px] font-semibold tracking-wide text-slate-300">TOOLS</div>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelectModule(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold transition-colors ${
              activeModule === t.id
                ? `bg-slate-700 border-slate-500 ${t.color}`
                : 'bg-slate-900/40 border-slate-700 text-slate-200 hover:border-slate-500'
            }`}
          >
            <span className={t.color}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
