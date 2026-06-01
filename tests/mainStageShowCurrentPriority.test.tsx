import test from 'node:test'
import assert from 'node:assert/strict'

import { getCurrentPreferredVersionIdForMainStage } from '../src/renderer/components/mainstage/MainStage'

function makeV(partial: any) {
  return {
    id: partial.id,
    assetId: 'a1',
    jobId: 'j',
    module: 'clean',
    qualityTier: 'preview',
    status: partial.status ?? 'preview_ready',
    lifecycleStatus: partial.lifecycleStatus,
    recipe: { basePrompt: 'x', injectors: [], guardrails: [], settings: {} },
    sourceVersionIds: [],
    createdAt: partial.createdAt ?? new Date().toISOString(),
    ...partial
  }
}

test('When approved exists, Show Current jumps to approved', () => {
  const versions = [
    makeV({ id: 'v1', createdAt: '2020-01-01T00:00:00.000Z' }),
    makeV({ id: 'v2', createdAt: '2020-01-02T00:00:00.000Z', lifecycleStatus: 'approved', status: 'approved' }),
    makeV({ id: 'v3', createdAt: '2020-01-03T00:00:00.000Z' })
  ]

  assert.equal(getCurrentPreferredVersionIdForMainStage(versions as any), 'v2')
})

test('When no approved, Show Current jumps to newest generated', () => {
  const versions = [
    makeV({ id: 'v1', createdAt: '2020-01-01T00:00:00.000Z' }),
    makeV({ id: 'v2', createdAt: '2020-01-03T00:00:00.000Z' }),
    makeV({ id: 'v3', createdAt: '2020-01-02T00:00:00.000Z' })
  ]

  assert.equal(getCurrentPreferredVersionIdForMainStage(versions as any), 'v2')
})

test('When only original exists, Show Current jumps to original (null)', () => {
  assert.equal(getCurrentPreferredVersionIdForMainStage([] as any), null)
})
