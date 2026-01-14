import React from 'react'

export interface ThreeColumnLayoutProps {
  left: React.ReactNode
  center: React.ReactNode
  right: React.ReactNode
}

export function ThreeColumnLayout({ left, center, right }: ThreeColumnLayoutProps) {
  return (
    <div className="flex-1 flex overflow-hidden">
      <aside
        data-testid="library-panel"
        className="w-[clamp(280px,22vw,420px)] min-w-[280px] max-w-[420px] flex-shrink-0 border-r border-slate-700 flex flex-col bg-slate-800/30 min-w-0"
      >
        {left}
      </aside>

      <main data-testid="mainstage-panel" className="flex-1 overflow-hidden min-w-0">
        {center}
      </main>

      <aside
        data-testid="inspector-panel"
        className="w-[clamp(320px,28vw,460px)] min-w-[320px] max-w-[460px] flex-shrink-0 border-l border-slate-700 flex flex-col bg-slate-800/30 min-w-0"
      >
        {right}
      </aside>
    </div>
  )
}
