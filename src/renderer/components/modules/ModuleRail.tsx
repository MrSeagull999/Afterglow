import React from 'react'
import type { ModuleType } from '../../../shared/types'
import {
  Moon,
  Eraser,
  Sofa,
  PaintBucket,
  Lightbulb,
  Grid3X3,
  Settings
} from 'lucide-react'

interface ModuleRailProps {
  activeModule: ModuleType | null
  onSelectModule: (module: ModuleType | null) => void
  onOpenLibrary: () => void
  onOpenSettings: () => void
}

const MODULES: { id: ModuleType; icon: React.ReactNode; label: string; color: string }[] = [
  { id: 'twilight', icon: <Moon className="w-5 h-5" />, label: 'Twilight', color: 'text-indigo-400' },
  { id: 'relight', icon: <Lightbulb className="w-5 h-5" />, label: 'ReLight', color: 'text-amber-400' },
  { id: 'clean', icon: <Eraser className="w-5 h-5" />, label: 'Clean Slate', color: 'text-emerald-400' },
  { id: 'stage', icon: <Sofa className="w-5 h-5" />, label: 'Staging', color: 'text-orange-400' },
  { id: 'renovate', icon: <PaintBucket className="w-5 h-5" />, label: 'Renovate', color: 'text-purple-400' }
]

export function ModuleRail({ activeModule, onSelectModule, onOpenLibrary, onOpenSettings }: ModuleRailProps) {
  return (
    <div className="w-16 flex flex-col items-center py-3 bg-slate-800/50 border-r border-slate-700">
      {/* Module Icons */}
      <div className="flex-1 flex flex-col items-center gap-1">
        {MODULES.map(module => (
          <button
            key={module.id}
            onClick={() => onSelectModule(activeModule === module.id ? null : module.id)}
            className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg transition-all ${
              activeModule === module.id
                ? `bg-slate-700 ${module.color}`
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
            title={module.label}
          >
            {module.icon}
            <span className="text-[9px] mt-0.5 font-medium">{module.label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-8 h-px bg-slate-700 my-2" />

      {/* Secondary Actions */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={onOpenLibrary}
          className="w-12 h-12 flex flex-col items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-all"
          title="Library"
        >
          <Grid3X3 className="w-5 h-5" />
          <span className="text-[9px] mt-0.5 font-medium">Library</span>
        </button>
        <button
          onClick={onOpenSettings}
          className="w-12 h-12 flex flex-col items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-all"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
          <span className="text-[9px] mt-0.5 font-medium">Settings</span>
        </button>
      </div>
    </div>
  )
}
