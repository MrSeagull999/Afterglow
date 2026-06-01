import test from 'node:test'
import assert from 'node:assert/strict'

import { applyBatchGenerationResults } from '../src/renderer/pages/JobPage'
import { buildNewVersion, getGenerationStatusUpdates } from '../src/main/core/store/versionStore'

test('Applying a tool immediately creates a version with pending generation state', () => {
  const v = buildNewVersion({
    jobId: 'j',
    assetId: 'a',
    module: 'clean',
    qualityTier: 'preview',
    recipe: { basePrompt: 'x', injectors: [], guardrails: [], settings: {} },
    nowMs: 123,
    createdAtIso: new Date(123).toISOString(),
    versionId: 'v1'
  })

  assert.equal(v.generationStatus, 'pending')
  assert.equal(v.startedAt, 123)
})

test('Successful generation transitions generationStatus to completed', () => {
  const u = getGenerationStatusUpdates('completed', 2000)
  assert.equal(u.generationStatus, 'completed')
  assert.equal(u.completedAt, 2000)
  assert.equal(u.generationError, undefined)
})

test('Failed generation transitions generationStatus to failed and preserves error', () => {
  const u = getGenerationStatusUpdates('failed', 2000, 'boom')
  assert.equal(u.generationStatus, 'failed')
  assert.equal(u.completedAt, 2000)
  assert.equal(u.generationError, 'boom')
})

test('Batch apply creates independent pending states per asset and switches viewer only for single selection', () => {
  const results = [
    { assetId: 'a1', versionId: 'v1' },
    { assetId: 'a2', versionId: 'v2' }
  ]

  const lastApplied: Record<string, string | null> = {}
  const viewed: Record<string, string | null> = {}

  applyBatchGenerationResults({
    assetIds: ['a1', 'a2'],
    results,
    setLastAppliedVersionId: (assetId: string, versionId: string | null) => {
      ;(lastApplied as Record<string, string | null>)[assetId] = versionId
    },
    setViewedVersionId: (assetId: string, versionId: string | null) => {
      ;(viewed as Record<string, string | null>)[assetId] = versionId
    }
  })

  assert.deepEqual(lastApplied, { a1: 'v1', a2: 'v2' })
  assert.deepEqual(viewed, {})

  applyBatchGenerationResults({
    assetIds: ['a1'],
    results: [{ assetId: 'a1', versionId: 'v99' }],
    setLastAppliedVersionId: (assetId: string, versionId: string | null) => {
      ;(lastApplied as Record<string, string | null>)[assetId] = versionId
    },
    setViewedVersionId: (assetId: string, versionId: string | null) => {
      ;(viewed as Record<string, string | null>)[assetId] = versionId
    }
  })

  assert.equal(lastApplied['a1'], 'v99')
  assert.equal(viewed['a1'], 'v99')
})
