import React from 'react'

interface ProgressBarProps {
  progress: number
  label?: string
  showPercentage?: boolean
  size?: 'sm' | 'md' | 'lg'
  color?: 'blue' | 'green' | 'amber' | 'purple'
}

export function ProgressBar({ 
  progress, 
  label, 
  showPercentage = true,
  size = 'md',
  color = 'blue'
}: ProgressBarProps) {
  const heights = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  }

  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    purple: 'bg-purple-500'
  }

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-xs text-slate-400">{label}</span>}
          {showPercentage && (
            <span className="text-xs text-slate-400">{Math.round(progress)}%</span>
          )}
        </div>
      )}
      <div className={`w-full bg-slate-700 rounded-full overflow-hidden ${heights[size]}`}>
        <div
          className={`${heights[size]} ${colors[color]} transition-all duration-300 ease-out`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  )
}
