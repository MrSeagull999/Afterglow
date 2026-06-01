import React, { useState, useEffect } from 'react'
import { Bug, ChevronDown, ChevronRight, X } from 'lucide-react'

interface GenerationLogEntry {
  timestamp: string
  jobId: string
  versionId: string
  provider: 'google' | 'openrouter'
  model: string
  endpoint: string
  promptHash: string
  module: string
  success: boolean
  error?: string
}

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [lastLog, setLastLog] = useState<GenerationLogEntry | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['provider']))

  useEffect(() => {
    const loadLastLog = async () => {
      try {
        const log = await window.api.invoke('debug:getLastLog')
        setLastLog(log)
      } catch (error) {
        console.error('Failed to load debug log:', error)
      }
    }

    if (isOpen) {
      loadLastLog()
      const interval = setInterval(loadLastLog, 2000)
      return () => clearInterval(interval)
    }
  }, [isOpen])

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-lg hover:bg-slate-700 transition-colors z-50"
        title="Open Debug Panel"
      >
        <Bug className="w-5 h-5 text-slate-400" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-[600px] bg-slate-900 border border-slate-600 rounded-lg shadow-2xl overflow-hidden z-50">
      <div className="flex items-center justify-between p-3 bg-slate-800 border-b border-slate-600">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-white">Debug Panel</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-slate-700 rounded transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="p-4 space-y-3 overflow-y-auto max-h-[540px]">
        {!lastLog ? (
          <div className="text-sm text-slate-500 text-center py-8">
            No generation logs yet
          </div>
        ) : (
          <>
            {/* Provider Info */}
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('provider')}
                className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-750 transition-colors"
              >
                <span className="text-sm font-medium text-white">Provider & Model</span>
                {expandedSections.has('provider') ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>
              {expandedSections.has('provider') && (
                <div className="p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Provider</span>
                    <span className="text-white font-mono capitalize">{lastLog.provider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Model</span>
                    <span className="text-white font-mono text-xs truncate max-w-[200px]" title={lastLog.model}>
                      {lastLog.model}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Module</span>
                    <span className="text-white font-mono">{lastLog.module}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Endpoint Info */}
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('endpoint')}
                className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-750 transition-colors"
              >
                <span className="text-sm font-medium text-white">Endpoint</span>
                {expandedSections.has('endpoint') ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>
              {expandedSections.has('endpoint') && (
                <div className="p-3">
                  <div className="text-xs font-mono text-white break-all bg-slate-950 p-2 rounded">
                    {lastLog.endpoint}
                  </div>
                </div>
              )}
            </div>

            {/* Prompt Hash */}
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('prompt')}
                className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-750 transition-colors"
              >
                <span className="text-sm font-medium text-white">Prompt Hash</span>
                {expandedSections.has('prompt') ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>
              {expandedSections.has('prompt') && (
                <div className="p-3">
                  <div className="text-xs font-mono text-white bg-slate-950 p-2 rounded">
                    {lastLog.promptHash}
                  </div>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('status')}
                className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-750 transition-colors"
              >
                <span className="text-sm font-medium text-white">Status</span>
                {expandedSections.has('status') ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>
              {expandedSections.has('status') && (
                <div className="p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Success</span>
                    <span className={lastLog.success ? 'text-emerald-400' : 'text-red-400'}>
                      {lastLog.success ? 'Yes' : 'No'}
                    </span>
                  </div>
                  {lastLog.error && (
                    <div>
                      <div className="text-slate-500 mb-1">Error</div>
                      <div className="text-red-400 bg-red-950/30 p-2 rounded text-xs break-words">
                        {lastLog.error}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Timestamp</span>
                    <span className="text-white font-mono">
                      {new Date(lastLog.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* IDs */}
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('ids')}
                className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-750 transition-colors"
              >
                <span className="text-sm font-medium text-white">IDs</span>
                {expandedSections.has('ids') ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>
              {expandedSections.has('ids') && (
                <div className="p-3 space-y-2 text-xs">
                  <div>
                    <div className="text-slate-500 mb-1">Job ID</div>
                    <div className="text-white font-mono bg-slate-950 p-1 rounded text-xs">
                      {lastLog.jobId}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-1">Version ID</div>
                    <div className="text-white font-mono bg-slate-950 p-1 rounded text-xs">
                      {lastLog.versionId}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
