import React from 'react'
import { useAppStore, LightingCondition } from '../store/useAppStore'
import { Play, CheckCircle, DollarSign, Loader2, Sun, Cloud } from 'lucide-react'

export function RunPanel() {
  const { 
    currentRun, 
    selectedImages,
    isProcessing,
    processingStage,
    costEstimate,
    setCostEstimate,
    setIsProcessing,
    setProcessingStage,
    updateImageInRun,
    addToast,
    approveSelectedImages,
    setCurrentRun,
    settings
  } = useAppStore()

  if (!currentRun) return null

  const pendingCount = currentRun.images.filter(i => i.status === 'pending').length
  const previewReadyCount = currentRun.images.filter(i => i.status === 'preview_ready').length
  const approvedCount = currentRun.images.filter(i => i.status === 'approved').length
  
  const lightingCondition = currentRun.lightingCondition || settings.defaultLightingCondition

  const handleLightingConditionChange = async (condition: LightingCondition) => {
    try {
      await window.electronAPI.updateRun(currentRun.id, { lightingCondition: condition })
      setCurrentRun({ ...currentRun, lightingCondition: condition })
      addToast(`Lighting condition set to ${condition}`, 'success')
    } catch (error) {
      addToast('Failed to update lighting condition', 'error')
    }
  }

  const handleEstimateCost = async () => {
    const estimate = await window.electronAPI.estimateCost({
      previewCount: pendingCount,
      finalCount: approvedCount
    })
    setCostEstimate(estimate)
  }

  const handleRunPreview = async () => {
    if (pendingCount === 0) {
      addToast('No pending images to preview', 'info')
      return
    }

    setIsProcessing(true)
    setProcessingStage('Generating previews...')

    const pendingImages = currentRun.images
      .filter(i => i.status === 'pending')
      .map(i => ({ path: i.path, presetId: i.presetId }))

    try {
      const unsubscribe = window.electronAPI.onPreviewProgress((data) => {
        if (data.progress !== undefined) {
          updateImageInRun(data.imagePath, { 
            progress: data.progress,
            status: data.progress < 100 ? 'preview_generating' : 'preview_ready'
          })
        }
        if (data.result) {
          updateImageInRun(data.imagePath, {
            status: data.result.success ? 'preview_ready' : 'error',
            previewPath: data.result.previewPath,
            error: data.result.error,
            progress: undefined
          })
        }
      })

      await window.electronAPI.generatePreviewBatch({
        runId: currentRun.id,
        images: pendingImages
      })

      unsubscribe()
      addToast(`Generated ${pendingImages.length} previews`, 'success')
    } catch (error) {
      console.error('Preview generation failed:', error)
      addToast('Preview generation failed', 'error')
    } finally {
      setIsProcessing(false)
      setProcessingStage('')
    }
  }

  const handleApproveSelected = async () => {
    if (selectedImages.size === 0) {
      addToast('No images selected', 'info')
      return
    }

    const selectedPaths = Array.from(selectedImages)
    const presetOverrides: Record<string, string> = {}
    
    currentRun.images.forEach(img => {
      if (selectedImages.has(img.path)) {
        presetOverrides[img.path] = img.presetId
      }
    })

    await window.electronAPI.approveImages(currentRun.id, selectedPaths, presetOverrides)
    approveSelectedImages()
    addToast(`Approved ${selectedPaths.length} images`, 'success')
  }

  const handleRunFinal = async () => {
    if (approvedCount === 0) {
      addToast('No approved images to finalize', 'info')
      return
    }

    setIsProcessing(true)
    setProcessingStage('Submitting batch job...')

    try {
      const submitResult = await window.electronAPI.submitBatch(currentRun.id)
      
      if (!submitResult.success) {
        throw new Error(submitResult.error || 'Batch submission failed')
      }

      addToast(`Batch submitted: ${submitResult.imageCount} images`, 'success')
      setProcessingStage('Polling batch status...')

      const pollInterval = setInterval(async () => {
        const pollResult = await window.electronAPI.pollBatch(currentRun.id, submitResult.batchId!)
        
        if (pollResult.status.state === 'SUCCEEDED') {
          clearInterval(pollInterval)
          setProcessingStage('Fetching results...')
          
          const fetchResult = await window.electronAPI.fetchBatchResults(currentRun.id, submitResult.batchId!)
          
          if (fetchResult.success) {
            addToast(`Finalized ${fetchResult.processedCount} images`, 'success')
          } else {
            addToast(`Fetch failed: ${fetchResult.error}`, 'error')
          }
          
          setIsProcessing(false)
          setProcessingStage('')
        } else if (pollResult.status.state === 'FAILED' || pollResult.status.state === 'CANCELLED') {
          clearInterval(pollInterval)
          addToast(`Batch ${pollResult.status.state.toLowerCase()}`, 'error')
          setIsProcessing(false)
          setProcessingStage('')
        }
      }, 30000)

    } catch (error) {
      console.error('Final generation failed:', error)
      addToast('Final generation failed', 'error')
      setIsProcessing(false)
      setProcessingStage('')
    }
  }

  return (
    <div className="p-4 bg-slate-800 rounded-lg space-y-4">
      <h3 className="font-medium text-white">Actions</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">Original Lighting</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleLightingConditionChange('overcast')}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                lightingCondition === 'overcast'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Cloud className="w-4 h-4" />
              <span className="text-sm">Overcast</span>
            </button>
            <button
              onClick={() => handleLightingConditionChange('sunny')}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                lightingCondition === 'sunny'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span className="text-sm">Sunny</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {lightingCondition === 'sunny' 
              ? 'Will remove harsh midday shadows before twilight conversion'
              : 'Minimal lighting correction (default)'}
          </p>
        </div>
      </div>

      <div className="space-y-2 text-sm text-slate-300">
        <div className="flex justify-between">
          <span>Pending:</span>
          <span className="font-medium">{pendingCount}</span>
        </div>
        <div className="flex justify-between">
          <span>Preview Ready:</span>
          <span className="font-medium">{previewReadyCount}</span>
        </div>
        <div className="flex justify-between">
          <span>Approved:</span>
          <span className="font-medium text-emerald-400">{approvedCount}</span>
        </div>
      </div>

      <div className="space-y-2">
        <button
          onClick={handleRunPreview}
          disabled={isProcessing || pendingCount === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:text-slate-400 text-white rounded-lg transition-colors"
        >
          {isProcessing && processingStage.includes('preview') ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Run Preview ({pendingCount})
        </button>

        <button
          onClick={handleApproveSelected}
          disabled={isProcessing || selectedImages.size === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:text-slate-400 text-white rounded-lg transition-colors"
        >
          <CheckCircle className="w-4 h-4" />
          Approve Selected ({selectedImages.size})
        </button>

        <button
          onClick={handleRunFinal}
          disabled={isProcessing || approvedCount === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-600 disabled:text-slate-400 text-white rounded-lg transition-colors"
        >
          {isProcessing && processingStage.includes('batch') ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Finalize 4K ({approvedCount})
        </button>
      </div>

      <button
        onClick={handleEstimateCost}
        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
      >
        <DollarSign className="w-4 h-4" />
        Estimate Cost
      </button>

      {costEstimate && (
        <div className="p-3 bg-slate-700 rounded-lg text-sm space-y-1">
          <div className="flex justify-between text-slate-300">
            <span>Preview ({costEstimate.previewCount})</span>
            <span>${costEstimate.previewTotalCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Final 4K ({costEstimate.finalCount})</span>
            <span>${costEstimate.finalTotalCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-medium text-white pt-1 border-t border-slate-600">
            <span>Total</span>
            <span>${costEstimate.totalCost.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
