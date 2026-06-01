export interface CostEstimate {
  previewCount: number
  previewCostPerImage: number
  previewTotalCost: number
  finalCount: number
  finalCostPerImage: number
  finalTotalCost: number
  totalCost: number
}

export interface ExtendedCostEstimate {
  preview: {
    count: number
    costPerImage: number
    totalCost: number
  }
  hqPreview: {
    count: number
    costPerImage: number
    totalCost: number
  }
  native4K: {
    count: number
    costPerImage: number
    totalCost: number
  }
  final: {
    count: number
    costPerImage: number
    totalCost: number
  }
  totalCost: number
  breakdown: string
}

// Cost estimates based on Gemini API pricing (Dec 2025)
// Nano Banana Pro (gemini-3-pro-image-preview) pricing:
// - 1K/2K images: ~$0.134 per image (1,120 tokens × $120/1M)
// - 4K images: ~$0.24 per image (2,000 tokens × $120/1M)
// 
// Current model (gemini-2.5-flash-image or similar) is cheaper:
// - Preview: ~$0.04 per image
// - If using Nano Banana Pro for previews: ~$0.134 per image
const COST_PER_IMAGE = {
  preview: 0.04,      // ~$0.04 per preview with current model (1024x1024)
  hqPreview: 0.134,   // ~$0.134 per HQ preview with Nano Banana Pro (1K-2K)
  native4K: 0.24,     // ~$0.24 per native 4K with Nano Banana Pro (3840x2160)
  final: 0.134        // ~$0.134 per final with Nano Banana Pro (2K)
} as const

// If switching to Nano Banana Pro for ALL generations:
// Preview would be $0.134 instead of $0.04 (3.35x more expensive)

export type QualityTierKey = keyof typeof COST_PER_IMAGE

const PREVIEW_COST_PER_IMAGE = 0.04
const FINAL_COST_PER_IMAGE = 0.12

export function estimateCost(params: {
  previewCount: number
  finalCount: number
}): CostEstimate {
  const previewTotalCost = params.previewCount * PREVIEW_COST_PER_IMAGE
  const finalTotalCost = params.finalCount * FINAL_COST_PER_IMAGE
  
  return {
    previewCount: params.previewCount,
    previewCostPerImage: PREVIEW_COST_PER_IMAGE,
    previewTotalCost: Math.round(previewTotalCost * 100) / 100,
    finalCount: params.finalCount,
    finalCostPerImage: FINAL_COST_PER_IMAGE,
    finalTotalCost: Math.round(finalTotalCost * 100) / 100,
    totalCost: Math.round((previewTotalCost + finalTotalCost) * 100) / 100
  }
}

export function estimateExtendedCost(params: {
  previewCount?: number
  hqPreviewCount?: number
  native4KCount?: number
  finalCount?: number
}): ExtendedCostEstimate {
  const previewCount = params.previewCount || 0
  const hqPreviewCount = params.hqPreviewCount || 0
  const native4KCount = params.native4KCount || 0
  const finalCount = params.finalCount || 0

  const previewTotal = previewCount * COST_PER_IMAGE.preview
  const hqPreviewTotal = hqPreviewCount * COST_PER_IMAGE.hqPreview
  const native4KTotal = native4KCount * COST_PER_IMAGE.native4K
  const finalTotal = finalCount * COST_PER_IMAGE.final

  const totalCost = previewTotal + hqPreviewTotal + native4KTotal + finalTotal

  const breakdownParts: string[] = []
  if (previewCount > 0) breakdownParts.push(`${previewCount} preview`)
  if (hqPreviewCount > 0) breakdownParts.push(`${hqPreviewCount} HQ`)
  if (native4KCount > 0) breakdownParts.push(`${native4KCount} 4K`)
  if (finalCount > 0) breakdownParts.push(`${finalCount} final`)

  return {
    preview: {
      count: previewCount,
      costPerImage: COST_PER_IMAGE.preview,
      totalCost: round2(previewTotal)
    },
    hqPreview: {
      count: hqPreviewCount,
      costPerImage: COST_PER_IMAGE.hqPreview,
      totalCost: round2(hqPreviewTotal)
    },
    native4K: {
      count: native4KCount,
      costPerImage: COST_PER_IMAGE.native4K,
      totalCost: round2(native4KTotal)
    },
    final: {
      count: finalCount,
      costPerImage: COST_PER_IMAGE.final,
      totalCost: round2(finalTotal)
    },
    totalCost: round2(totalCost),
    breakdown: breakdownParts.join(' + ') || 'No generations'
  }
}

export function estimateSingleGenerationCost(qualityTier: QualityTierKey): number {
  return COST_PER_IMAGE[qualityTier]
}

export function getCostPerImage(): typeof COST_PER_IMAGE {
  return { ...COST_PER_IMAGE }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function formatCost(amount: number): string {
  return `$${amount.toFixed(2)}`
}
