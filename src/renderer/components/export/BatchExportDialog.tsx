import React, { useState } from 'react'
import { X, Download, Loader2 } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

type ExportFormat = 'original' | 'tiff_16bit' | 'jpeg'

interface BatchExportDialogProps {
  open: boolean
  onClose: () => void
  jobId: string
  versionIds: string[]
}

export function BatchExportDialog({ open, onClose, jobId, versionIds }: BatchExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('tiff_16bit')
  const [maxWidth, setMaxWidth] = useState(4000)
  const [isExporting, setIsExporting] = useState(false)
  const { addToast } = useAppStore()

  if (!open) return null

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const result = await window.api.invoke('export:batch', {
        jobId,
        versionIds,
        format,
        maxWidth,
        jpegQuality: 95
      })

      if (!result) {
        // User cancelled folder picker
        return
      }

      if (result.failed.length > 0) {
        addToast(`Exported ${result.exported} images (${result.failed.length} failed)`, 'error')
      } else {
        addToast(`Exported ${result.exported} images to ${result.outputFolder}`, 'success')
      }
      onClose()
    } catch (error) {
      addToast('Batch export failed', 'error')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative w-full max-w-md mx-4 bg-slate-800 rounded-lg shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-medium text-white">Batch Export</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-sm text-slate-300">
            Exporting <span className="text-white font-medium">{versionIds.length}</span> images
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-300">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="tiff_16bit">16-bit TIFF (Lightroom-ready)</option>
              <option value="jpeg">JPEG (95% quality)</option>
              <option value="original">Original format (as-is)</option>
            </select>
          </div>

          {format !== 'original' && (
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Max Width (px)</label>
              <input
                type="number"
                value={maxWidth}
                onChange={(e) => setMaxWidth(Number(e.target.value))}
                min={1024}
                max={8000}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500">
                Images will be resized to this width (aspect ratio preserved). Won't upscale.
              </p>
            </div>
          )}

          <div className="text-xs text-slate-500">
            Files will be named using the original filename with an "_afterglow" suffix.
            You'll be prompted to choose the output folder.
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || versionIds.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export All
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
