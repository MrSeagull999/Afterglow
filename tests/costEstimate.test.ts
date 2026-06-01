import test from 'node:test'
import assert from 'node:assert/strict'

import {
  estimateCost,
  estimateExtendedCost,
  estimateSingleGenerationCost,
  getCostPerImage,
  formatCost
} from '../src/main/core/costEstimate'

// ─────────────────────────────────────────────────────────────
// Legacy estimateCost tests (backward compatibility)
// ─────────────────────────────────────────────────────────────

test('estimateCost: calculates preview and final costs correctly', () => {
  const result = estimateCost({ previewCount: 10, finalCount: 5 })
  
  assert.equal(result.previewCount, 10)
  assert.equal(result.previewCostPerImage, 0.04)
  assert.equal(result.previewTotalCost, 0.40)
  
  assert.equal(result.finalCount, 5)
  assert.equal(result.finalCostPerImage, 0.12)
  assert.equal(result.finalTotalCost, 0.60)
  
  assert.equal(result.totalCost, 1.00)
})

test('estimateCost: handles zero counts', () => {
  const result = estimateCost({ previewCount: 0, finalCount: 0 })
  
  assert.equal(result.previewTotalCost, 0)
  assert.equal(result.finalTotalCost, 0)
  assert.equal(result.totalCost, 0)
})

// ─────────────────────────────────────────────────────────────
// Extended cost estimation tests
// ─────────────────────────────────────────────────────────────

test('estimateExtendedCost: calculates all quality tier costs', () => {
  const result = estimateExtendedCost({
    previewCount: 10,
    hqPreviewCount: 5,
    native4KCount: 2,
    finalCount: 3
  })
  
  // Preview: 10 × $0.04 = $0.40
  assert.equal(result.preview.count, 10)
  assert.equal(result.preview.costPerImage, 0.04)
  assert.equal(result.preview.totalCost, 0.40)
  
  // HQ Preview: 5 × $0.08 = $0.40
  assert.equal(result.hqPreview.count, 5)
  assert.equal(result.hqPreview.costPerImage, 0.08)
  assert.equal(result.hqPreview.totalCost, 0.40)
  
  // Native 4K: 2 × $0.15 = $0.30
  assert.equal(result.native4K.count, 2)
  assert.equal(result.native4K.costPerImage, 0.15)
  assert.equal(result.native4K.totalCost, 0.30)
  
  // Final: 3 × $0.12 = $0.36
  assert.equal(result.final.count, 3)
  assert.equal(result.final.costPerImage, 0.12)
  assert.equal(result.final.totalCost, 0.36)
  
  // Total: $0.40 + $0.40 + $0.30 + $0.36 = $1.46
  assert.equal(result.totalCost, 1.46)
})

test('estimateExtendedCost: handles partial counts', () => {
  const result = estimateExtendedCost({
    previewCount: 5,
    native4KCount: 1
  })
  
  assert.equal(result.preview.count, 5)
  assert.equal(result.preview.totalCost, 0.20)
  
  assert.equal(result.hqPreview.count, 0)
  assert.equal(result.hqPreview.totalCost, 0)
  
  assert.equal(result.native4K.count, 1)
  assert.equal(result.native4K.totalCost, 0.15)
  
  assert.equal(result.final.count, 0)
  assert.equal(result.final.totalCost, 0)
  
  assert.equal(result.totalCost, 0.35)
})

test('estimateExtendedCost: generates correct breakdown string', () => {
  const result1 = estimateExtendedCost({
    previewCount: 10,
    hqPreviewCount: 5,
    native4KCount: 2,
    finalCount: 3
  })
  assert.equal(result1.breakdown, '10 preview + 5 HQ + 2 4K + 3 final')
  
  const result2 = estimateExtendedCost({
    previewCount: 5
  })
  assert.equal(result2.breakdown, '5 preview')
  
  const result3 = estimateExtendedCost({})
  assert.equal(result3.breakdown, 'No generations')
})

test('estimateExtendedCost: handles zero counts', () => {
  const result = estimateExtendedCost({
    previewCount: 0,
    hqPreviewCount: 0,
    native4KCount: 0,
    finalCount: 0
  })
  
  assert.equal(result.totalCost, 0)
  assert.equal(result.breakdown, 'No generations')
})

// ─────────────────────────────────────────────────────────────
// Single generation cost tests
// ─────────────────────────────────────────────────────────────

test('estimateSingleGenerationCost: returns correct cost per tier', () => {
  assert.equal(estimateSingleGenerationCost('preview'), 0.04)
  assert.equal(estimateSingleGenerationCost('hqPreview'), 0.08)
  assert.equal(estimateSingleGenerationCost('native4K'), 0.15)
  assert.equal(estimateSingleGenerationCost('final'), 0.12)
})

// ─────────────────────────────────────────────────────────────
// getCostPerImage tests
// ─────────────────────────────────────────────────────────────

test('getCostPerImage: returns all tier costs', () => {
  const costs = getCostPerImage()
  
  assert.equal(costs.preview, 0.04)
  assert.equal(costs.hqPreview, 0.08)
  assert.equal(costs.native4K, 0.15)
  assert.equal(costs.final, 0.12)
})

test('getCostPerImage: returns a copy (not the original object)', () => {
  const costs1 = getCostPerImage()
  const costs2 = getCostPerImage()
  
  assert.notEqual(costs1, costs2) // Different object references
  assert.deepEqual(costs1, costs2) // Same values
})

// ─────────────────────────────────────────────────────────────
// formatCost tests
// ─────────────────────────────────────────────────────────────

test('formatCost: formats currency correctly', () => {
  assert.equal(formatCost(0), '$0.00')
  assert.equal(formatCost(0.04), '$0.04')
  assert.equal(formatCost(1.5), '$1.50')
  assert.equal(formatCost(10.99), '$10.99')
  assert.equal(formatCost(100), '$100.00')
})

// ─────────────────────────────────────────────────────────────
// Cost tier ordering tests (native 4K should be most expensive)
// ─────────────────────────────────────────────────────────────

test('Cost tiers: native 4K is the most expensive per image', () => {
  const costs = getCostPerImage()
  
  assert.ok(costs.native4K > costs.preview, 'Native 4K should cost more than preview')
  assert.ok(costs.native4K > costs.hqPreview, 'Native 4K should cost more than HQ preview')
  assert.ok(costs.native4K > costs.final, 'Native 4K should cost more than final')
})

test('Cost tiers: preview is the cheapest', () => {
  const costs = getCostPerImage()
  
  assert.ok(costs.preview < costs.hqPreview, 'Preview should cost less than HQ preview')
  assert.ok(costs.preview < costs.native4K, 'Preview should cost less than native 4K')
  assert.ok(costs.preview < costs.final, 'Preview should cost less than final')
})
