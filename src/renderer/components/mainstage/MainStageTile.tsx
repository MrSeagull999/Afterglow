import React from 'react'
import type { Asset, Version } from '../../../shared/types'
import { resolveGenerationStatus } from '../../../shared/resolveGenerationStatus'
import { AlertCircle, Loader2, Layers } from 'lucide-react'

export function MainStageTile({
  asset,
  viewedVersion,
  thumbDataUrl,
  onClick,
  isWorkingSource
}: {
  asset: Asset
  viewedVersion: Version | null
  thumbDataUrl: string | null
  onClick: () => void
  isWorkingSource?: boolean
}) {
  const label = asset.displayName || asset.name
  const status = resolveGenerationStatus(viewedVersion)

  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className="group relative rounded-lg border border-slate-700 bg-slate-900 overflow-hidden hover:border-slate-500 transition-colors"
    >
      <div className="aspect-square bg-slate-950">
        {thumbDataUrl ? (
          <img src={thumbDataUrl} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
            Preview
          </div>
        )}

        {status === 'pending' && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/40"
            data-testid="mainstage-tile-pending"
          >
            <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
          </div>
        )}

        {status === 'failed' && (
          <div className="absolute top-2 right-2" data-testid="mainstage-tile-failed">
            <AlertCircle className="w-5 h-5 text-amber-400 drop-shadow" />
          </div>
        )}

        {isWorkingSource && (
          <div className="absolute top-2 left-2" data-testid="mainstage-tile-source">
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-teal-600/90 rounded text-[10px] text-white font-medium shadow">
              <Layers className="w-3 h-3" />
              Source
            </div>
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1">
        <div className="text-[11px] text-slate-200 truncate">{label}</div>
      </div>
    </button>
  )
}
