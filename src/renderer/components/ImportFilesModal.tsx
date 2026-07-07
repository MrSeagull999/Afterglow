import React, { useEffect, useMemo, useState } from 'react'
import { useJobStore } from '../store/useJobStore'
import { useAppStore } from '../store/useAppStore'
import { FolderPlus, FolderOpen, Loader2, X, Image } from 'lucide-react'

interface ImportFilesModalProps {
  filePaths: string[]
  onClose: () => void
}

function fileName(path: string): string {
  return path.split('/').pop() ?? path
}

function parentFolderName(path: string): string {
  const parts = path.split('/')
  return parts.length >= 2 ? parts[parts.length - 2] : ''
}

export function ImportFilesModal({ filePaths, onClose }: ImportFilesModalProps) {
  const { jobs, loadJobs, createJob, setCurrentJob } = useJobStore()
  const { setView, addToast } = useAppStore()

  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [newJobName, setNewJobName] = useState('')
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [isImporting, setIsImporting] = useState(false)

  const sortedJobs = useMemo(
    () => [...jobs].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')),
    [jobs]
  )

  useEffect(() => {
    loadJobs()
  }, [])

  // Sensible defaults: job name from the shoot folder, most recent job selected
  useEffect(() => {
    if (filePaths.length > 0 && !newJobName) {
      setNewJobName(parentFolderName(filePaths[0]))
    }
  }, [filePaths])

  useEffect(() => {
    if (sortedJobs.length > 0 && !selectedJobId) {
      setSelectedJobId(sortedJobs[0].id)
    }
  }, [sortedJobs])

  const canImport =
    filePaths.length > 0 &&
    !isImporting &&
    (mode === 'new' ? newJobName.trim().length > 0 : selectedJobId !== '')

  const handleImport = async () => {
    if (!canImport) return
    setIsImporting(true)
    try {
      let job
      if (mode === 'new') {
        job = await createJob(newJobName.trim())
      } else {
        job = sortedJobs.find((j) => j.id === selectedJobId)
        if (!job) throw new Error('Selected job not found')
      }

      const result = await window.api.invoke('files:importToJob', job.id, filePaths)
      if (result.errors.length > 0) {
        addToast(`Imported ${result.imported.length}, ${result.errors.length} failed`, 'error')
      } else {
        addToast(`Imported ${result.imported.length} image${result.imported.length === 1 ? '' : 's'} into "${job.name}"`, 'success')
      }

      setCurrentJob(job)
      setView('job')
      onClose()
    } catch (error: any) {
      addToast(`Import failed: ${error.message}`, 'error')
      setIsImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[520px] max-h-[80vh] flex flex-col bg-slate-800 border border-slate-700 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            Import {filePaths.length} image{filePaths.length === 1 ? '' : 's'}
          </h2>
          <button
            onClick={onClose}
            disabled={isImporting}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File list */}
        <div className="px-6 py-3 border-b border-slate-700 max-h-36 overflow-y-auto">
          {filePaths.map((path) => (
            <div key={path} className="flex items-center gap-2 py-0.5 text-sm text-slate-300">
              <Image className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span className="truncate">{fileName(path)}</span>
            </div>
          ))}
        </div>

        {/* Destination */}
        <div className="px-6 py-4 space-y-3">
          <div
            onClick={() => setMode('new')}
            className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors cursor-pointer ${
              mode === 'new'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-700 hover:border-slate-600'
            }`}
          >
            <FolderPlus className="w-5 h-5 mt-0.5 text-blue-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white">New project</div>
              {mode === 'new' && (
                <input
                  autoFocus
                  type="text"
                  value={newJobName}
                  onChange={(e) => setNewJobName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                  placeholder="Project name"
                  className="mt-2 w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              )}
            </div>
          </div>

          <div
            onClick={() => sortedJobs.length > 0 && setMode('existing')}
            className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
              sortedJobs.length === 0 ? 'opacity-50' : 'cursor-pointer'
            } ${
              mode === 'existing'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-700 hover:border-slate-600'
            }`}
          >
            <FolderOpen className="w-5 h-5 mt-0.5 text-blue-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white">
                Add to existing project
                {sortedJobs.length === 0 && (
                  <span className="ml-2 text-sm font-normal text-slate-500">(none yet)</span>
                )}
              </div>
              {mode === 'existing' && sortedJobs.length > 0 && (
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2 w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white focus:outline-none focus:border-blue-500"
                >
                  {sortedJobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!canImport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isImporting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isImporting ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
