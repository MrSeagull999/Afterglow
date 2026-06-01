import React from 'react'
import { AlertCircle, Check, Loader2 } from 'lucide-react'

export type VersionDotState = 'idle' | 'pending' | 'failed' | 'completed'

export interface VersionDotsProps {
  count: number
  activeIndex: number
  getAriaLabel: (index: number) => string
  getState: (index: number) => VersionDotState
  isApproved?: (index: number) => boolean
  onSelectIndex?: (index: number) => void
}

export function VersionDots(props: VersionDotsProps) {
  if (props.count <= 1) return null

  return (
    <div className="flex items-center gap-1.5" data-testid="mainstage-version-dots">
      {Array.from({ length: props.count }).map((_, index) => {
        const isActive = index === props.activeIndex
        const state = props.getState(index)

        const baseClass =
          'w-2.5 h-2.5 rounded-full border border-slate-600 flex items-center justify-center transition-colors'
        const activeClass = isActive ? 'bg-slate-200 border-slate-200' : 'bg-slate-800'

        const content = (() => {
          if (state === 'pending') {
            return <Loader2 className="w-2 h-2 text-blue-400 animate-spin" />
          }
          if (state === 'failed') {
            return <AlertCircle className="w-2 h-2 text-amber-400" />
          }
          if (props.isApproved?.(index)) {
            return <Check className="w-2 h-2 text-emerald-400" data-testid={`mainstage-version-dot-approved-${index}`} />
          }
          return null
        })()

        const commonProps = {
          type: 'button' as const,
          'data-testid': `mainstage-version-dot-${index}`,
          'aria-label': props.getAriaLabel(index),
          'aria-current': isActive ? ('true' as const) : undefined,
          onClick: props.onSelectIndex ? () => props.onSelectIndex?.(index) : undefined,
          className: `${baseClass} ${activeClass}`
        }

        return (
          <button key={index} {...commonProps}>
            {content}
          </button>
        )
      })}
    </div>
  )
}
