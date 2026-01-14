import test from 'node:test'
import assert from 'node:assert/strict'

import { getNextBatchAssetIdByPredicate, useJobStore } from '../src/renderer/store/useJobStore'

function makeVersion(id: string, assetId: string, generationStatus: 'pending' | 'completed' | 'failed') {
  return {
    id,
    assetId,
    jobId: 'j',
    module: 'clean',
    qualityTier: 'preview',
    generationStatus,
    recipe: { basePrompt: 'x', injectors: [], guardrails: [], settings: {} },
    sourceVersionIds: [],
    createdAt: new Date().toISOString()
  } as any
}

test('Next Failed advances from current focus to next failed and wraps around', () => {
  const batchRun = {
    id: 'r',
    moduleId: 'clean',
    startedAt: Date.now(),
    assetIds: ['a1', 'a2', 'a3', 'a4'],
    createdVersionIdsByAssetId: { a1: 'v1', a2: 'v2', a3: 'v3', a4: 'v4' },
    failedAssetIds: [],
    dismissed: false
  } as any

  const versionsByAssetId = {
    a1: [makeVersion('v1', 'a1', 'completed')],
    a2: [makeVersion('v2', 'a2', 'failed')],
    a3: [makeVersion('v3', 'a3', 'pending')],
    a4: [makeVersion('v4', 'a4', 'failed')]
  }

  const nextFromA2 = getNextBatchAssetIdByPredicate({
    batchRun,
    versionsByAssetId,
    currentAssetId: 'a2',
    predicate: (s) => s === 'failed'
  })
  assert.equal(nextFromA2, 'a4')

  const nextFromA4 = getNextBatchAssetIdByPredicate({
    batchRun,
    versionsByAssetId,
    currentAssetId: 'a4',
    predicate: (s) => s === 'failed'
  })
  assert.equal(nextFromA4, 'a2')
})

test('Next Pending advances from current focus and wraps around', () => {
  const batchRun = {
    id: 'r',
    moduleId: 'clean',
    startedAt: Date.now(),
    assetIds: ['a1', 'a2', 'a3'],
    createdVersionIdsByAssetId: { a1: 'v1', a2: 'v2', a3: 'v3' },
    failedAssetIds: [],
    dismissed: false
  } as any

  const versionsByAssetId = {
    a1: [makeVersion('v1', 'a1', 'pending')],
    a2: [makeVersion('v2', 'a2', 'completed')],
    a3: [makeVersion('v3', 'a3', 'pending')]
  }

  const nextFromA1 = getNextBatchAssetIdByPredicate({
    batchRun,
    versionsByAssetId,
    currentAssetId: 'a1',
    predicate: (s) => s === 'pending'
  })
  assert.equal(nextFromA1, 'a3')

  const nextFromA3 = getNextBatchAssetIdByPredicate({
    batchRun,
    versionsByAssetId,
    currentAssetId: 'a3',
    predicate: (s) => s === 'pending'
  })
  assert.equal(nextFromA3, 'a1')
})

test('When none exist, helper returns null', () => {
  const batchRun = {
    id: 'r',
    moduleId: 'clean',
    startedAt: Date.now(),
    assetIds: ['a1', 'a2'],
    createdVersionIdsByAssetId: { a1: 'v1', a2: 'v2' },
    failedAssetIds: [],
    dismissed: false
  } as any

  const versionsByAssetId = {
    a1: [makeVersion('v1', 'a1', 'completed')],
    a2: [makeVersion('v2', 'a2', 'completed')]
  }

  const nextFailed = getNextBatchAssetIdByPredicate({
    batchRun,
    versionsByAssetId,
    currentAssetId: 'a1',
    predicate: (s) => s === 'failed'
  })

  assert.equal(nextFailed, null)
})

test('Asset in failedAssetIds without createdVersionId is treated as failed', () => {
  const batchRun = {
    id: 'r',
    moduleId: 'clean',
    startedAt: Date.now(),
    assetIds: ['a1', 'a2', 'a3'],
    createdVersionIdsByAssetId: { a1: 'v1', a3: 'v3' },
    failedAssetIds: ['a2'],
    dismissed: false
  } as any

  const versionsByAssetId = {
    a1: [makeVersion('v1', 'a1', 'completed')],
    a3: [makeVersion('v3', 'a3', 'completed')]
  }

  const nextFailed = getNextBatchAssetIdByPredicate({
    batchRun,
    versionsByAssetId,
    currentAssetId: 'a1',
    predicate: (s) => s === 'failed'
  })

  assert.equal(nextFailed, 'a2')
})

test('Store action jumpToNextFailedInBatchRun selects next failed and does not overwrite viewedVersionId when createdVersionId missing', () => {
  useJobStore.setState({
    versionsByAssetId: {
      a1: [makeVersion('v1', 'a1', 'completed')],
      a3: [makeVersion('v3', 'a3', 'completed')]
    },
    viewedVersionIdByAssetId: { a2: 'keep_me' },
    selectedAssetIds: new Set(['a1']),
    activeBatchRun: {
      id: 'r',
      moduleId: 'clean',
      startedAt: Date.now(),
      assetIds: ['a1', 'a2', 'a3'],
      createdVersionIdsByAssetId: { a1: 'v1', a3: 'v3' },
      failedAssetIds: ['a2'],
      dismissed: false
    }
  } as any)

  useJobStore.getState().jumpToNextFailedInBatchRun()

  const state = useJobStore.getState()
  assert.deepEqual(Array.from(state.selectedAssetIds), ['a2'])
  assert.equal(state.viewedVersionIdByAssetId['a2'], 'keep_me')
})
