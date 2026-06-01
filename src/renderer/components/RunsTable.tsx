import React from 'react'
import { useAppStore, Run } from '../store/useAppStore'
import { FolderOpen, Clock, Image, ChevronRight } from 'lucide-react'

export function RunsTable() {
  const { runs, setCurrentRunId, setCurrentRun, setView } = useAppStore()

  const handleOpenRun = async (run: Run) => {
    const fullRun = await window.electronAPI.getRun(run.id)
    if (fullRun) {
      setCurrentRun(fullRun)
      setCurrentRunId(run.id)
      setView('run')
    }
  }

  if (runs.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No recent runs</p>
        <p className="text-sm mt-1">Select a listing folder to get started</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700">
      <table className="w-full">
        <thead className="bg-slate-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              Listing
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              Images
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              Created
            </th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {runs.map(run => (
            <tr 
              key={run.id}
              onClick={() => handleOpenRun(run)}
              className="bg-slate-800/50 hover:bg-slate-700/50 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <FolderOpen className="w-5 h-5 text-slate-400" />
                  <div>
                    <div className="font-medium text-white">{run.listingName}</div>
                    <div className="text-xs text-slate-500 truncate max-w-xs">{run.inputDir}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 text-slate-300">
                  <Image className="w-4 h-4" />
                  <span>{run.images.length}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <RunStatusBadge run={run} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>{formatDate(run.createdAt)}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <ChevronRight className="w-5 h-5 text-slate-500" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RunStatusBadge({ run }: { run: Run }) {
  const approved = run.images.filter(i => i.status === 'approved').length
  const finalReady = run.images.filter(i => i.status === 'final_ready').length
  const previewReady = run.images.filter(i => i.status === 'preview_ready').length
  const errors = run.images.filter(i => i.status === 'error').length

  if (finalReady > 0) {
    return (
      <span className="px-2 py-1 text-xs font-medium bg-amber-600/20 text-amber-400 rounded">
        {finalReady} Finalized
      </span>
    )
  }

  if (approved > 0) {
    return (
      <span className="px-2 py-1 text-xs font-medium bg-emerald-600/20 text-emerald-400 rounded">
        {approved} Approved
      </span>
    )
  }

  if (previewReady > 0) {
    return (
      <span className="px-2 py-1 text-xs font-medium bg-green-600/20 text-green-400 rounded">
        {previewReady} Previewed
      </span>
    )
  }

  if (errors > 0) {
    return (
      <span className="px-2 py-1 text-xs font-medium bg-red-600/20 text-red-400 rounded">
        {errors} Errors
      </span>
    )
  }

  return (
    <span className="px-2 py-1 text-xs font-medium bg-slate-600/20 text-slate-400 rounded">
      Pending
    </span>
  )
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  
  return date.toLocaleDateString()
}
