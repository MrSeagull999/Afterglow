export interface CostEstimate {
  previewCount: number
  previewCostPerImage: number
  previewTotalCost: number
  finalCount: number
  finalCostPerImage: number
  finalTotalCost: number
  totalCost: number
}

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

export function formatCost(amount: number): string {
  return `$${amount.toFixed(2)}`
}
