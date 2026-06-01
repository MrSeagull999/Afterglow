import React, { useEffect, useState } from 'react'
import { DollarSign, Info } from 'lucide-react'

export interface CostPerImage {
  preview: number
  hqPreview: number
  native4K: number
  final: number
}

// Fallback costs if IPC fails (matches costEstimate.ts)
// Based on Gemini API pricing (Dec 2025)
const DEFAULT_COSTS: CostPerImage = {
  preview: 0.04,      // Current model
  hqPreview: 0.134,   // Nano Banana Pro 1K-2K
  native4K: 0.24,     // Nano Banana Pro 4K
  final: 0.134        // Nano Banana Pro 2K
}

export interface CostEstimateDisplayProps {
  previewCount?: number
  hqPreviewCount?: number
  native4KCount?: number
  finalCount?: number
  compact?: boolean
  showPerImageCosts?: boolean
}

export function CostEstimateDisplay(props: CostEstimateDisplayProps) {
  const [costPerImage, setCostPerImage] = useState<CostPerImage>(DEFAULT_COSTS)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadCosts() {
      try {
        const costs = await window.api.invoke('cost:getCostPerImage')
        if (costs) {
          setCostPerImage(costs)
        }
      } catch (error) {
        // Use default costs silently - IPC may not be ready yet
        console.debug('[CostEstimate] Using default costs, IPC not ready')
      } finally {
        setIsLoading(false)
      }
    }
    loadCosts()
  }, [])

  // Don't block rendering - we have default costs

  const {
    previewCount = 0,
    hqPreviewCount = 0,
    native4KCount = 0,
    finalCount = 0
  } = props

  const previewTotal = previewCount * costPerImage.preview
  const hqPreviewTotal = hqPreviewCount * costPerImage.hqPreview
  const native4KTotal = native4KCount * costPerImage.native4K
  const finalTotal = finalCount * costPerImage.final
  const totalCost = previewTotal + hqPreviewTotal + native4KTotal + finalTotal

  const hasAnyCounts = previewCount > 0 || hqPreviewCount > 0 || native4KCount > 0 || finalCount > 0

  if (!hasAnyCounts && !props.showPerImageCosts) {
    return null
  }

  const formatCost = (amount: number) => `$${amount.toFixed(2)}`

  if (props.compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <DollarSign className="w-3 h-3" />
        <span>Est. {formatCost(totalCost)}</span>
      </div>
    )
  }

  return (
    <div className="p-3 bg-slate-800 border border-slate-700 rounded-lg text-xs space-y-2">
      <div className="flex items-center gap-2 text-slate-300 font-medium">
        <DollarSign className="w-4 h-4" />
        <span>Cost Estimate</span>
      </div>

      {props.showPerImageCosts && (
        <div className="space-y-1 text-slate-400 border-b border-slate-700 pb-2 mb-2">
          <div className="flex justify-between">
            <span>Preview (per image)</span>
            <span className="text-slate-300">{formatCost(costPerImage.preview)}</span>
          </div>
          <div className="flex justify-between">
            <span>HQ Preview (per image)</span>
            <span className="text-slate-300">{formatCost(costPerImage.hqPreview)}</span>
          </div>
          <div className="flex justify-between">
            <span>Native 4K (per image)</span>
            <span className="text-slate-300">{formatCost(costPerImage.native4K)}</span>
          </div>
          <div className="flex justify-between">
            <span>Final (per image)</span>
            <span className="text-slate-300">{formatCost(costPerImage.final)}</span>
          </div>
        </div>
      )}

      {hasAnyCounts && (
        <>
          <div className="space-y-1 text-slate-400">
            {previewCount > 0 && (
              <div className="flex justify-between">
                <span>Preview × {previewCount}</span>
                <span className="text-slate-300">{formatCost(previewTotal)}</span>
              </div>
            )}
            {hqPreviewCount > 0 && (
              <div className="flex justify-between">
                <span>HQ Preview × {hqPreviewCount}</span>
                <span className="text-slate-300">{formatCost(hqPreviewTotal)}</span>
              </div>
            )}
            {native4KCount > 0 && (
              <div className="flex justify-between">
                <span>Native 4K × {native4KCount}</span>
                <span className="text-slate-300">{formatCost(native4KTotal)}</span>
              </div>
            )}
            {finalCount > 0 && (
              <div className="flex justify-between">
                <span>Final × {finalCount}</span>
                <span className="text-slate-300">{formatCost(finalTotal)}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-2 border-t border-slate-700 font-medium text-white">
            <span>Total</span>
            <span>{formatCost(totalCost)}</span>
          </div>
        </>
      )}

      <div className="flex items-start gap-1.5 text-[10px] text-slate-500 pt-1">
        <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
        <span>Estimates based on Gemini API pricing. Actual costs may vary.</span>
      </div>
    </div>
  )
}

export function SingleGenerationCostBadge({ tier }: { tier: 'preview' | 'hqPreview' | 'native4K' | 'final' }) {
  const [costPerImage, setCostPerImage] = useState<CostPerImage>(DEFAULT_COSTS)

  useEffect(() => {
    async function loadCosts() {
      try {
        const costs = await window.api.invoke('cost:getCostPerImage')
        if (costs) {
          setCostPerImage(costs)
        }
      } catch (error) {
        // Use default costs silently
      }
    }
    loadCosts()
  }, [])

  const cost = costPerImage[tier]
  return (
    <span className="text-[10px] text-slate-500 ml-1">
      (~${cost.toFixed(2)})
    </span>
  )
}
