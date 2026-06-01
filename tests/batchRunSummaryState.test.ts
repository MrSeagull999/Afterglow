import test from 'node:test'
import assert from 'node:assert/strict'

import { useJobStore, getBatchRunCounts } from '../src/renderer/store/useJobStore'

test('startBatchRun stores run with assetIds + createdVersionIds mapping', () => {
  useJobStore.setState({
    versionsByAssetId: {},
    viewedVersionIdByAssetId: {},
    selectedAssetIds: new Set(),
    activeBatchRun: undefined
  } as any)

  useJobStore.getState().startBatchRun({
    moduleId: 'clean',
    assetIds: ['a1', 'a2'],
    createdVersionIdsByAssetId: { a1: 'v1' }
  })

  const run = useJobStore.getState().activeBatchRun
  assert.ok(run)
  assert.equal(run.moduleId, 'clean')
  assert.deepEqual(run.assetIds, ['a1', 'a2'])
  assert.deepEqual(run.createdVersionIdsByAssetId, { a1: 'v1' })
  assert.equal(typeof run.startedAt, 'number')
  assert.ok(run.startedAt > 0)
})

test('counts computed correctly using resolveGenerationStatus on created versions', () => {
  useJobStore.setState({
    versionsByAssetId: {
      a1: [
        {
          id: 'v1',
          assetId: 'a1',
          jobId: 'j',
          module: 'clean',
          qualityTier: 'preview',
          generationStatus: 'pending',
          recipe: { basePrompt: 'x', injectors: [], guardrails: [], settings: {} },
          sourceVersionIds: [],
          createdAt: new Date().toISOString()
        } as any
      ],
      a2: [
        {
          id: 'v2',
          assetId: 'a2',
          jobId: 'j',
          module: 'clean',
          qualityTier: 'preview',
          generationStatus: 'completed',
          recipe: { basePrompt: 'x', injectors: [], guardrails: [], settings: {} },
          sourceVersionIds: [],
          createdAt: new Date().toISOString()
        } as any
      ],
      a3: [
        {
          id: 'v3',
          assetId: 'a3',
          jobId: 'j',
          module: 'clean',
          qualityTier: 'preview',
          generationStatus: 'failed',
          generationError: 'Boom',
          recipe: { basePrompt: 'x', injectors: [], guardrails: [], settings: {} },
          sourceVersionIds: [],
          createdAt: new Date().toISOString()
        } as any
      ]
    }
  } as any)

  useJobStore.getState().startBatchRun({
    moduleId: 'clean',
    assetIds: ['a1', 'a2', 'a3'],
    createdVersionIdsByAssetId: { a1: 'v1', a2: 'v2', a3: 'v3' }
  })

  const run = useJobStore.getState().activeBatchRun!
  const counts = getBatchRunCounts({ batchRun: run, versionsByAssetId: useJobStore.getState().versionsByAssetId })

  assert.deepEqual(counts, { pending: 1, completed: 1, failed: 1 })
})

test('dismissBatchRun hides summary', () => {
  useJobStore.setState({
    versionsByAssetId: {},
    activeBatchRun: undefined
  } as any)

  useJobStore.getState().startBatchRun({
    moduleId: 'clean',
    assetIds: ['a1', 'a2'],
    createdVersionIdsByAssetId: { a1: 'v1', a2: 'v2' }
  })

  assert.ok(useJobStore.getState().getActiveBatchRunCounts())

  useJobStore.getState().dismissBatchRun()

  assert.equal(useJobStore.getState().getActiveBatchRunCounts(), null)
})

test('starting a new batch run replaces the old one', () => {
  useJobStore.setState({
    versionsByAssetId: {},
    activeBatchRun: undefined
  } as any)

  useJobStore.getState().startBatchRun({
    moduleId: 'clean',
    assetIds: ['a1'],
    createdVersionIdsByAssetId: { a1: 'v1' }
  })

  const first = useJobStore.getState().activeBatchRun!

  useJobStore.getState().startBatchRun({
    moduleId: 'stage',
    assetIds: ['a2', 'a3'],
    createdVersionIdsByAssetId: { a2: 'v2' }
  })

  const second = useJobStore.getState().activeBatchRun!

  assert.notEqual(second.id, first.id)
  assert.equal(second.moduleId, 'stage')
  assert.deepEqual(second.assetIds, ['a2', 'a3'])
  assert.deepEqual(second.createdVersionIdsByAssetId, { a2: 'v2' })
})
