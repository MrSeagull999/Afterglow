import React, { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Gallery } from '../components/Gallery'
import { RunPanel } from '../components/RunPanel'
import { PresetSelector } from '../components/PresetPicker'

export function RunDetail() {
  const { currentRun, currentRunId, setCurrentRun, addToast } = useAppStore()
  const seedRejectedShown = useRef(false)

  useEffect(() => {
    if (currentRunId && !currentRun) {
      window.electronAPI.getRun(currentRunId).then(run => {
        if (run) setCurrentRun(run)
      })
    }
  }, [currentRunId, currentRun, setCurrentRun])

  useEffect(() => {
    const unsubPreview = window.electronAPI.onPreviewProgress((data) => {
      console.log('Preview progress:', data)
      
      // Refresh run data when preview completes
      if (data.progress === 100 && currentRunId) {
        setTimeout(async () => {
          const updatedRun = await window.electronAPI.getRun(currentRunId)
          if (updatedRun) {
            setCurrentRun(updatedRun)
          }
        }, 500)
      }
    })

    const unsubBatch = window.electronAPI.onBatchProgress((data) => {
      console.log('Batch progress:', data)
    })

    const unsubSeedRejected = window.electronAPI.onSeedRejected(() => {
      if (!seedRejectedShown.current) {
        seedRejectedShown.current = true
        addToast('Seed not supported by model/API; continuing without seed.', 'info')
      }
    })

    return () => {
      unsubPreview()
      unsubBatch()
      unsubSeedRejected()
    }
  }, [addToast, currentRunId, setCurrentRun])

  if (!currentRun) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        Loading run...
      </div>
    )
  }

  return (
    <div className="h-full flex">
      <aside className="w-72 border-r border-slate-700 p-4 space-y-4 overflow-auto scrollbar-thin">
        <PresetSelector />
        <RunPanel />
      </aside>

      <div className="flex-1 overflow-hidden">
        <Gallery />
      </div>
    </div>
  )
}
