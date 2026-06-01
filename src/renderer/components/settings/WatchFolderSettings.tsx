import React, { useEffect, useState } from 'react'
import { useJobStore } from '../../store/useJobStore'
import { useAppStore } from '../../store/useAppStore'
import { Eye, EyeOff, FolderOpen, Loader2 } from 'lucide-react'

export function WatchFolderSettings() {
  const { jobs, loadJobs } = useJobStore()
  const { addToast } = useAppStore()

  const [isActive, setIsActive] = useState(false)
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Load current state on mount
  useEffect(() => {
    window.api.invoke('watchFolder:getState').then((state: any) => {
      setIsActive(state.active)
      if (state.folderPath) setFolderPath(state.folderPath)
      if (state.jobId) setSelectedJobId(state.jobId)
    })
    loadJobs()
  }, [])

  // Listen for status updates from main process
  useEffect(() => {
    const off = window.api.on('watchFolder:status', (data: any) => {
      setIsActive(data.active)
    })
    return off
  }, [])

  const handleSelectFolder = async () => {
    const path = await window.api.invoke('watchFolder:selectFolder')
    if (path) setFolderPath(path)
  }

  const handleToggle = async () => {
    if (!folderPath || !selectedJobId) {
      addToast('Select a folder and a job first', 'error')
      return
    }

    setIsLoading(true)
    try {
      if (isActive) {
        await window.api.invoke('watchFolder:stop')
        setIsActive(false)
        addToast('Watch folder stopped', 'info')
      } else {
        const result = await window.api.invoke('watchFolder:start', folderPath, selectedJobId)
        if (result.success) {
          setIsActive(true)
          addToast(`Watching ${folderPath}`, 'success')
        } else {
          addToast(result.error || 'Failed to start watch folder', 'error')
        }
      }
    } catch (error) {
      addToast('Watch folder error', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-slate-600'}`} />
        <span className="text-sm text-slate-300">
          {isActive ? 'Watching for new images' : 'Not active'}
        </span>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-slate-400">Lightroom export folder</label>
        <div className="flex gap-2">
          <div className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-300 truncate">
            {folderPath || 'No folder selected'}
          </div>
          <button
            onClick={handleSelectFolder}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-sm text-slate-200 transition-colors flex-shrink-0"
          >
            <FolderOpen className="w-4 h-4" />
            Browse
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-slate-400">Import into job</label>
        <select
          value={selectedJobId || ''}
          onChange={(e) => setSelectedJobId(e.target.value || null)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a job...</option>
          {jobs.map(job => (
            <option key={job.id} value={job.id}>{job.name}</option>
          ))}
        </select>
      </div>

      <button
        onClick={handleToggle}
        disabled={isLoading || !folderPath || !selectedJobId}
        className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          isActive
            ? 'bg-red-700 hover:bg-red-600 text-white'
            : 'bg-emerald-700 hover:bg-emerald-600 text-white'
        }`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isActive ? (
          <><EyeOff className="w-4 h-4" /> Stop Watching</>
        ) : (
          <><Eye className="w-4 h-4" /> Start Watching</>
        )}
      </button>

      <p className="text-xs text-slate-500">
        New images dropped into this folder will automatically be imported into the selected job.
        Existing files are not re-imported.
      </p>
    </div>
  )
}
