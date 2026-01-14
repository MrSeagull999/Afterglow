import React from 'react'

export function LibraryHeader() {
  return (
    <div
      data-testid="library-header"
      className="flex-shrink-0 min-h-12 border-b border-slate-700 flex items-center px-4 bg-slate-800/50"
    >
      <div className="text-xs font-bold text-slate-200 whitespace-normal leading-tight">
        LIBRARY — ASSETS & SELECTION ONLY
      </div>
    </div>
  )
}
